-- ============================================================
-- MobiERP - Add FIFO/LIFO Inventory Costing Support
-- Run this after production-schema.sql
-- ============================================================

-- ============================================================
-- 1. CREATE SETTINGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE system_settings IS 'System-wide configuration settings';

-- Insert default inventory method setting
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('inventory_costing_method', 'FIFO', 'Inventory costing method: FIFO, LIFO, or AVERAGE')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 2. CREATE INVENTORY PURCHASES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  CONSTRAINT valid_remaining CHECK (remaining_quantity <= quantity)
);

COMMENT ON TABLE inventory_purchases IS 'Tracks inventory purchases for FIFO/LIFO costing';
COMMENT ON COLUMN inventory_purchases.remaining_quantity IS 'Quantity not yet sold';

-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_inventory_purchases_product ON inventory_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_date ON inventory_purchases(purchased_at);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_remaining ON inventory_purchases(remaining_quantity) WHERE remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations" ON system_settings;
DROP POLICY IF EXISTS "Enable all operations" ON inventory_purchases;

CREATE POLICY "Enable all operations" ON system_settings FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON inventory_purchases FOR ALL USING (true);

-- ============================================================
-- 5. CREATE FUNCTION TO GET INVENTORY COSTING METHOD
-- ============================================================

DROP FUNCTION IF EXISTS get_inventory_costing_method();
CREATE OR REPLACE FUNCTION get_inventory_costing_method()
RETURNS TEXT AS $$
DECLARE
  v_method TEXT;
BEGIN
  SELECT setting_value INTO v_method
  FROM system_settings
  WHERE setting_key = 'inventory_costing_method';
  
  RETURN COALESCE(v_method, 'FIFO');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. CREATE FUNCTION TO CALCULATE COST FOR SALE (FIFO/LIFO)
-- ============================================================

DROP FUNCTION IF EXISTS calculate_sale_cost(UUID, INTEGER);
CREATE OR REPLACE FUNCTION calculate_sale_cost(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_method TEXT;
  v_total_cost DECIMAL(10,2) := 0;
  v_remaining_to_allocate INTEGER := p_quantity;
  v_purchase RECORD;
  v_allocated INTEGER;
BEGIN
  -- Get costing method
  v_method := get_inventory_costing_method();
  
  IF v_method = 'FIFO' THEN
    -- First In, First Out - oldest purchases first
    FOR v_purchase IN 
      SELECT id, unit_cost, remaining_quantity
      FROM inventory_purchases
      WHERE product_id = p_product_id 
        AND remaining_quantity > 0
      ORDER BY purchased_at ASC, id ASC
    LOOP
      v_allocated := LEAST(v_purchase.remaining_quantity, v_remaining_to_allocate);
      v_total_cost := v_total_cost + (v_allocated * v_purchase.unit_cost);
      v_remaining_to_allocate := v_remaining_to_allocate - v_allocated;
      
      EXIT WHEN v_remaining_to_allocate = 0;
    END LOOP;
    
  ELSIF v_method = 'LIFO' THEN
    -- Last In, First Out - newest purchases first
    FOR v_purchase IN 
      SELECT id, unit_cost, remaining_quantity
      FROM inventory_purchases
      WHERE product_id = p_product_id 
        AND remaining_quantity > 0
      ORDER BY purchased_at DESC, id DESC
    LOOP
      v_allocated := LEAST(v_purchase.remaining_quantity, v_remaining_to_allocate);
      v_total_cost := v_total_cost + (v_allocated * v_purchase.unit_cost);
      v_remaining_to_allocate := v_remaining_to_allocate - v_allocated;
      
      EXIT WHEN v_remaining_to_allocate = 0;
    END LOOP;
    
  ELSE
    -- AVERAGE or fallback - use weighted average
    SELECT 
      COALESCE(SUM(remaining_quantity * unit_cost) / NULLIF(SUM(remaining_quantity), 0), 0)
    INTO v_total_cost
    FROM inventory_purchases
    WHERE product_id = p_product_id 
      AND remaining_quantity > 0;
    
    v_total_cost := v_total_cost * p_quantity;
  END IF;
  
  RETURN ROUND(v_total_cost, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. CREATE FUNCTION TO ALLOCATE INVENTORY ON SALE
-- ============================================================

DROP FUNCTION IF EXISTS allocate_inventory_on_sale(UUID, INTEGER);
CREATE OR REPLACE FUNCTION allocate_inventory_on_sale(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_method TEXT;
  v_remaining_to_allocate INTEGER := p_quantity;
  v_purchase RECORD;
  v_allocated INTEGER;
BEGIN
  -- Get costing method
  v_method := get_inventory_costing_method();
  
  IF v_method = 'FIFO' THEN
    -- Allocate from oldest purchases first
    FOR v_purchase IN 
      SELECT id, remaining_quantity
      FROM inventory_purchases
      WHERE product_id = p_product_id 
        AND remaining_quantity > 0
      ORDER BY purchased_at ASC, id ASC
      FOR UPDATE
    LOOP
      v_allocated := LEAST(v_purchase.remaining_quantity, v_remaining_to_allocate);
      
      UPDATE inventory_purchases
      SET remaining_quantity = remaining_quantity - v_allocated
      WHERE id = v_purchase.id;
      
      v_remaining_to_allocate := v_remaining_to_allocate - v_allocated;
      
      EXIT WHEN v_remaining_to_allocate = 0;
    END LOOP;
    
  ELSIF v_method = 'LIFO' THEN
    -- Allocate from newest purchases first
    FOR v_purchase IN 
      SELECT id, remaining_quantity
      FROM inventory_purchases
      WHERE product_id = p_product_id 
        AND remaining_quantity > 0
      ORDER BY purchased_at DESC, id DESC
      FOR UPDATE
    LOOP
      v_allocated := LEAST(v_purchase.remaining_quantity, v_remaining_to_allocate);
      
      UPDATE inventory_purchases
      SET remaining_quantity = remaining_quantity - v_allocated
      WHERE id = v_purchase.id;
      
      v_remaining_to_allocate := v_remaining_to_allocate - v_allocated;
      
      EXIT WHEN v_remaining_to_allocate = 0;
    END LOOP;
    
  ELSE
    -- AVERAGE - allocate proportionally from all batches
    FOR v_purchase IN 
      SELECT id, remaining_quantity
      FROM inventory_purchases
      WHERE product_id = p_product_id 
        AND remaining_quantity > 0
      ORDER BY purchased_at ASC, id ASC
      FOR UPDATE
    LOOP
      v_allocated := LEAST(v_purchase.remaining_quantity, v_remaining_to_allocate);
      
      UPDATE inventory_purchases
      SET remaining_quantity = remaining_quantity - v_allocated
      WHERE id = v_purchase.id;
      
      v_remaining_to_allocate := v_remaining_to_allocate - v_allocated;
      
      EXIT WHEN v_remaining_to_allocate = 0;
    END LOOP;
  END IF;
  
  -- Verify we allocated everything
  IF v_remaining_to_allocate > 0 THEN
    RAISE EXCEPTION 'Insufficient inventory to allocate. Missing: % units', v_remaining_to_allocate;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. MIGRATE EXISTING PRODUCTS TO INVENTORY PURCHASES
-- ============================================================

-- For existing products, create a purchase record with current stock
INSERT INTO inventory_purchases (product_id, quantity, unit_cost, remaining_quantity, purchased_at, notes)
SELECT 
  id,
  stock,
  cost,
  stock,
  created_at,
  'Migrated from existing inventory'
FROM products
WHERE stock > 0
  AND is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM inventory_purchases ip WHERE ip.product_id = products.id
  );

-- ============================================================
-- 9. CREATE TRIGGER TO USE FIFO/LIFO COSTING ON SALES
-- ============================================================

-- First, drop the old trigger that uses simple stock reduction
DROP TRIGGER IF EXISTS reduce_stock_on_sale ON sale_items;
DROP TRIGGER IF EXISTS allocate_inventory_on_sale ON sale_items;
DROP FUNCTION IF EXISTS check_and_allocate_inventory();

-- Create new trigger that uses FIFO/LIFO allocation
CREATE OR REPLACE FUNCTION check_and_allocate_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_product_stock INTEGER;
  v_product_sku VARCHAR;
  v_calculated_cost DECIMAL(10,2);
BEGIN
  -- Check if product exists and has enough stock
  SELECT stock, sku INTO v_product_stock, v_product_sku
  FROM products
  WHERE id = NEW.product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', NEW.product_id;
  END IF;
  
  IF v_product_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product % (SKU: %). Available: %, Required: %', 
      NEW.product_id, v_product_sku, v_product_stock, NEW.quantity;
  END IF;
  
  -- Calculate cost based on FIFO/LIFO/AVERAGE
  v_calculated_cost := calculate_sale_cost(NEW.product_id, NEW.quantity);
  
  -- Update the cost_price to the calculated value (total cost for quantity)
  NEW.cost_price := v_calculated_cost / NEW.quantity;
  
  -- Allocate inventory from purchases
  PERFORM allocate_inventory_on_sale(NEW.product_id, NEW.quantity);
  
  -- Reduce stock in products table
  UPDATE products
  SET stock = stock - NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER allocate_inventory_on_sale
  BEFORE INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION check_and_allocate_inventory();

COMMENT ON TRIGGER allocate_inventory_on_sale ON sale_items IS 'Allocates inventory using FIFO/LIFO/AVERAGE and calculates cost';

-- ============================================================
-- 10. CREATE TRIGGERS TO RECORD PURCHASES
-- ============================================================

-- Trigger for when products are FIRST CREATED with stock
DROP TRIGGER IF EXISTS record_initial_purchase_on_insert ON products;
DROP FUNCTION IF EXISTS record_initial_inventory_purchase();

CREATE OR REPLACE FUNCTION record_initial_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  -- Only track if product has initial stock
  IF NEW.stock > 0 THEN
    -- Try to get current user from session
    v_current_user_id := NULL;
    
    -- Record the initial purchase
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      remaining_quantity,
      purchased_by,
      purchased_at,
      notes
    ) VALUES (
      NEW.id,
      NEW.stock,
      NEW.cost,
      NEW.stock,
      v_current_user_id,
      NEW.created_at,
      'Initial inventory - product created'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_initial_purchase_on_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_initial_inventory_purchase();

COMMENT ON TRIGGER record_initial_purchase_on_insert ON products IS 'Records initial inventory purchase when product is created';

-- Trigger for when stock is ADDED to existing products
DROP TRIGGER IF EXISTS record_purchase_on_stock_increase ON products;
DROP FUNCTION IF EXISTS record_inventory_purchase();

CREATE OR REPLACE FUNCTION record_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_quantity_added INTEGER;
  v_current_user_id UUID;
BEGIN
  -- Only track when stock increases
  IF NEW.stock > OLD.stock THEN
    v_quantity_added := NEW.stock - OLD.stock;
    
    -- Try to get current user from session (you may need to set this via application)
    -- For now, we'll leave it NULL
    v_current_user_id := NULL;
    
    -- Record the purchase
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      remaining_quantity,
      purchased_by,
      notes
    ) VALUES (
      NEW.id,
      v_quantity_added,
      NEW.cost,
      v_quantity_added,
      v_current_user_id,
      'Stock added via inventory update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_purchase_on_stock_increase
  AFTER UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.stock > OLD.stock)
  EXECUTE FUNCTION record_inventory_purchase();

COMMENT ON TRIGGER record_purchase_on_stock_increase ON products IS 'Records inventory purchase when stock is increased';

-- ============================================================
-- 11. VERIFICATION QUERIES
-- ============================================================

-- Show current setting
SELECT 
  'Current Inventory Costing Method' as info,
  setting_value as method,
  description
FROM system_settings
WHERE setting_key = 'inventory_costing_method';

-- Show inventory purchases summary
SELECT 
  p.sku,
  p.brand,
  p.model,
  COUNT(ip.id) as purchase_batches,
  SUM(ip.quantity) as total_purchased,
  SUM(ip.remaining_quantity) as remaining_units,
  AVG(ip.unit_cost)::DECIMAL(10,2) as avg_cost
FROM inventory_purchases ip
JOIN products p ON ip.product_id = p.id
WHERE ip.remaining_quantity > 0
GROUP BY p.id, p.sku, p.brand, p.model
ORDER BY p.brand, p.model
LIMIT 10;

-- ============================================================
-- DONE! FIFO/LIFO support added
-- Use Settings page to change between FIFO, LIFO, or AVERAGE
-- ============================================================
