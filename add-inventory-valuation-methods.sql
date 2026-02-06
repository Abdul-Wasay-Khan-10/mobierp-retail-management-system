-- ============================================================
-- MobiERP - Inventory Valuation Methods (FIFO/LIFO/AVERAGE)
-- For DISPLAY purposes only - shows inventory value on reports
-- Sales always use current product cost
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

-- Insert default inventory valuation method setting
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('inventory_valuation_method', 'FIFO', 'Inventory valuation method for reports: FIFO, LIFO, or AVERAGE')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- 2. CREATE INVENTORY PURCHASES TABLE (for tracking history)
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost DECIMAL(10,2) NOT NULL CHECK (unit_cost >= 0),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  purchased_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

COMMENT ON TABLE inventory_purchases IS 'Tracks inventory purchase history for valuation methods';
COMMENT ON COLUMN inventory_purchases.unit_cost IS 'Cost per unit at time of purchase';

-- ============================================================
-- 3. CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_inventory_purchases_product ON inventory_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_date ON inventory_purchases(purchased_at);
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
-- 5. CREATE FUNCTION TO GET INVENTORY VALUATION METHOD
-- ============================================================

DROP FUNCTION IF EXISTS get_inventory_valuation_method();
CREATE OR REPLACE FUNCTION get_inventory_valuation_method()
RETURNS TEXT AS $$
DECLARE
  v_method TEXT;
BEGIN
  SELECT setting_value INTO v_method
  FROM system_settings
  WHERE setting_key = 'inventory_valuation_method';
  
  RETURN COALESCE(v_method, 'FIFO');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. CREATE FUNCTION TO CALCULATE INVENTORY VALUE
-- ============================================================

DROP FUNCTION IF EXISTS calculate_inventory_value();
CREATE OR REPLACE FUNCTION calculate_inventory_value()
RETURNS TABLE (
  product_id UUID,
  current_stock INTEGER,
  valuation_cost DECIMAL(10,2),
  total_value DECIMAL(10,2),
  method_used TEXT
) AS $$
DECLARE
  v_method TEXT;
BEGIN
  v_method := get_inventory_valuation_method();
  
  IF v_method = 'FIFO' THEN
    -- First In, First Out - use oldest purchase costs
    RETURN QUERY
    WITH ranked_purchases AS (
      SELECT 
        p.id as prod_id,
        p.stock as current_qty,
        ip.unit_cost,
        ip.quantity,
        ip.purchased_at,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY ip.purchased_at ASC) as purchase_rank,
        SUM(ip.quantity) OVER (PARTITION BY p.id ORDER BY ip.purchased_at ASC) as cumulative_qty
      FROM products p
      LEFT JOIN inventory_purchases ip ON p.id = ip.product_id
      WHERE p.is_active = true AND p.stock > 0
    ),
    allocated_costs AS (
      SELECT 
        prod_id,
        current_qty,
        SUM(
          CASE 
            WHEN cumulative_qty <= current_qty THEN unit_cost * quantity
            WHEN cumulative_qty - quantity < current_qty THEN unit_cost * (current_qty - (cumulative_qty - quantity))
            ELSE 0
          END
        ) as total_cost
      FROM ranked_purchases
      WHERE unit_cost IS NOT NULL
      GROUP BY prod_id, current_qty
    )
    SELECT 
      ac.prod_id,
      ac.current_qty,
      CASE 
        WHEN ac.current_qty > 0 THEN ROUND(ac.total_cost / ac.current_qty, 2)
        ELSE 0
      END as valuation_cost,
      ROUND(ac.total_cost, 2) as total_value,
      'FIFO'::TEXT as method_used
    FROM allocated_costs ac;
    
  ELSIF v_method = 'LIFO' THEN
    -- Last In, First Out - use newest purchase costs
    RETURN QUERY
    WITH ranked_purchases AS (
      SELECT 
        p.id as prod_id,
        p.stock as current_qty,
        ip.unit_cost,
        ip.quantity,
        ip.purchased_at,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY ip.purchased_at DESC) as purchase_rank,
        SUM(ip.quantity) OVER (PARTITION BY p.id ORDER BY ip.purchased_at DESC) as cumulative_qty
      FROM products p
      LEFT JOIN inventory_purchases ip ON p.id = ip.product_id
      WHERE p.is_active = true AND p.stock > 0
    ),
    allocated_costs AS (
      SELECT 
        prod_id,
        current_qty,
        SUM(
          CASE 
            WHEN cumulative_qty <= current_qty THEN unit_cost * quantity
            WHEN cumulative_qty - quantity < current_qty THEN unit_cost * (current_qty - (cumulative_qty - quantity))
            ELSE 0
          END
        ) as total_cost
      FROM ranked_purchases
      WHERE unit_cost IS NOT NULL
      GROUP BY prod_id, current_qty
    )
    SELECT 
      ac.prod_id,
      ac.current_qty,
      CASE 
        WHEN ac.current_qty > 0 THEN ROUND(ac.total_cost / ac.current_qty, 2)
        ELSE 0
      END as valuation_cost,
      ROUND(ac.total_cost, 2) as total_value,
      'LIFO'::TEXT as method_used
    FROM allocated_costs ac;
    
  ELSE
    -- AVERAGE - weighted average of all purchases
    RETURN QUERY
    SELECT 
      p.id as product_id,
      p.stock as current_stock,
      COALESCE(
        ROUND(SUM(ip.unit_cost * ip.quantity) / NULLIF(SUM(ip.quantity), 0), 2),
        p.cost
      ) as valuation_cost,
      ROUND(
        p.stock * COALESCE(
          SUM(ip.unit_cost * ip.quantity) / NULLIF(SUM(ip.quantity), 0),
          p.cost
        ), 2
      ) as total_value,
      'AVERAGE'::TEXT as method_used
    FROM products p
    LEFT JOIN inventory_purchases ip ON p.id = ip.product_id
    WHERE p.is_active = true AND p.stock > 0
    GROUP BY p.id, p.stock, p.cost;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_inventory_value IS 'Calculates inventory value using selected method (FIFO/LIFO/AVERAGE) for reports only';

-- ============================================================
-- 7. CREATE VIEW FOR INVENTORY VALUE REPORT
-- ============================================================

DROP VIEW IF EXISTS inventory_value_report;
CREATE OR REPLACE VIEW inventory_value_report AS
SELECT 
  p.id,
  p.sku,
  p.brand,
  p.model,
  c.name as category_name,
  p.stock as current_stock,
  p.cost as current_cost,
  COALESCE(iv.valuation_cost, p.cost) as valued_at,
  COALESCE(iv.total_value, p.stock * p.cost) as total_value,
  COALESCE(iv.method_used, 'CURRENT') as valuation_method
FROM products p
JOIN categories c ON p.category_id = c.id
LEFT JOIN calculate_inventory_value() iv ON p.id = iv.product_id
WHERE p.is_active = true
ORDER BY total_value DESC;

COMMENT ON VIEW inventory_value_report IS 'Inventory valuation report showing values based on selected method';

-- ============================================================
-- 8. CREATE TRIGGER TO RECORD PURCHASES
-- ============================================================

-- Trigger for when products are FIRST CREATED with stock
DROP TRIGGER IF EXISTS record_initial_purchase_on_insert ON products;
DROP FUNCTION IF EXISTS record_initial_inventory_purchase();

CREATE OR REPLACE FUNCTION record_initial_inventory_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Record initial purchase for valuation tracking
  IF NEW.stock > 0 THEN
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      purchased_at,
      notes
    ) VALUES (
      NEW.id,
      NEW.stock,
      NEW.cost,
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

COMMENT ON TRIGGER record_initial_purchase_on_insert ON products IS 'Records initial inventory purchase for valuation';

-- Trigger for when stock is ADDED to existing products
DROP TRIGGER IF EXISTS record_purchase_on_stock_increase ON products;
DROP FUNCTION IF EXISTS record_inventory_purchase();

CREATE OR REPLACE FUNCTION record_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_quantity_added INTEGER;
BEGIN
  -- Record purchase when stock increases
  IF NEW.stock > OLD.stock THEN
    v_quantity_added := NEW.stock - OLD.stock;
    
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      purchased_at,
      notes
    ) VALUES (
      NEW.id,
      v_quantity_added,
      NEW.cost,
      NOW(),
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
-- 9. MIGRATE EXISTING PRODUCTS TO INVENTORY PURCHASES
-- ============================================================

-- For existing products, create a purchase record with current stock
INSERT INTO inventory_purchases (product_id, quantity, unit_cost, purchased_at, notes)
SELECT 
  id,
  stock,
  cost,
  created_at,
  'Migrated from existing inventory'
FROM products
WHERE stock > 0
  AND is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM inventory_purchases ip WHERE ip.product_id = products.id
  );

-- ============================================================
-- 10. VERIFICATION QUERIES
-- ============================================================

-- Show current setting
SELECT 
  'Current Inventory Valuation Method' as info,
  setting_value as method,
  description
FROM system_settings
WHERE setting_key = 'inventory_valuation_method';

-- Show inventory value comparison
SELECT 
  'Inventory Valuation Summary' as report_type,
  valuation_method,
  COUNT(DISTINCT id) as products_count,
  SUM(current_stock) as total_units,
  SUM(total_value)::DECIMAL(10,2) as total_inventory_value
FROM inventory_value_report
GROUP BY valuation_method
ORDER BY valuation_method;

-- Show sample products with valuation
SELECT 
  sku,
  brand,
  model,
  current_stock,
  current_cost,
  valued_at,
  total_value,
  valuation_method
FROM inventory_value_report
ORDER BY total_value DESC
LIMIT 10;

-- ============================================================
-- DONE! Inventory valuation methods added
-- Sales will continue to use product.cost (no change)
-- Use Settings page to change between FIFO, LIFO, or AVERAGE
-- This only affects how inventory value is DISPLAYED in reports
-- ============================================================
