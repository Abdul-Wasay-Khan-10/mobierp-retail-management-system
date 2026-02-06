-- ============================================================
-- MobiERP - Database Improvements & Security Enhancements
-- Apply these improvements to make your database more bulletproof
-- ============================================================

-- IMPROVEMENT 1: Add function to safely add product stock
-- ============================================================
CREATE OR REPLACE FUNCTION add_product_stock(
  p_product_id UUID,
  p_additional_stock INTEGER
)
RETURNS VOID AS $$
BEGIN
  IF p_additional_stock < 0 THEN
    RAISE EXCEPTION 'Cannot add negative stock';
  END IF;
  
  UPDATE products 
  SET stock = stock + p_additional_stock,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 2: Add audit log table for tracking changes
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  old_values JSONB,
  new_values JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(changed_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Enable all operations" ON audit_log FOR ALL USING (true);

-- IMPROVEMENT 3: Add trigger to prevent negative stock
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_negative_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative for product %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_negative_stock_trigger ON products;
CREATE TRIGGER prevent_negative_stock_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.stock IS DISTINCT FROM OLD.stock)
  EXECUTE FUNCTION prevent_negative_stock();

-- IMPROVEMENT 4: Add sale total validation trigger
-- ============================================================
CREATE OR REPLACE FUNCTION validate_sale_total()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO calculated_total
  FROM sale_items
  WHERE sale_id = NEW.id;
  
  IF ABS(calculated_total - NEW.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Sale total mismatch: Expected %, Got %', calculated_total, NEW.total_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_sale_total_trigger ON sales;
CREATE TRIGGER validate_sale_total_trigger
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION validate_sale_total();

-- IMPROVEMENT 5: Add function to get low stock products
-- ============================================================
CREATE OR REPLACE FUNCTION get_low_stock_products(threshold INTEGER DEFAULT 5)
RETURNS TABLE (
  product_id UUID,
  sku VARCHAR(50),
  brand VARCHAR(100),
  model VARCHAR(200),
  current_stock INTEGER,
  category_name VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.sku,
    p.brand,
    p.model,
    p.stock,
    c.name
  FROM products p
  JOIN categories c ON p.category_id = c.id
  WHERE p.stock <= threshold
  ORDER BY p.stock ASC, p.brand, p.model;
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 6: Add function to calculate profit for a date range
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_profit(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_revenue DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  gross_profit DECIMAL(10,2),
  profit_margin DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(si.unit_price * si.quantity), 0)::DECIMAL(10,2) as total_revenue,
    COALESCE(SUM(si.cost_price * si.quantity), 0)::DECIMAL(10,2) as total_cost,
    COALESCE(SUM((si.unit_price - si.cost_price) * si.quantity), 0)::DECIMAL(10,2) as gross_profit,
    CASE 
      WHEN SUM(si.unit_price * si.quantity) > 0 
      THEN (SUM((si.unit_price - si.cost_price) * si.quantity) / SUM(si.unit_price * si.quantity) * 100)::DECIMAL(5,2)
      ELSE 0::DECIMAL(5,2)
    END as profit_margin
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  WHERE (start_date IS NULL OR s.created_at >= start_date)
    AND (end_date IS NULL OR s.created_at <= end_date);
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 7: Add function to get seller performance
-- ============================================================
CREATE OR REPLACE FUNCTION get_seller_performance(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  seller_id UUID,
  seller_name VARCHAR(100),
  total_sales INTEGER,
  total_revenue DECIMAL(10,2),
  total_profit DECIMAL(10,2),
  avg_sale_value DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    COUNT(DISTINCT s.id)::INTEGER as total_sales,
    COALESCE(SUM(s.total_amount), 0)::DECIMAL(10,2) as total_revenue,
    COALESCE(SUM(si.unit_price * si.quantity - si.cost_price * si.quantity), 0)::DECIMAL(10,2) as total_profit,
    COALESCE(AVG(s.total_amount), 0)::DECIMAL(10,2) as avg_sale_value
  FROM users u
  LEFT JOIN sales s ON u.id = s.seller_id
    AND (start_date IS NULL OR s.created_at >= start_date)
    AND (end_date IS NULL OR s.created_at <= end_date)
  LEFT JOIN sale_items si ON s.id = si.sale_id
  WHERE u.role IN ('OWNER', 'STAFF')
    AND u.is_active = true
  GROUP BY u.id, u.name
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 8: Add constraint to prevent deleting user with sales
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_user_deletion_with_sales()
RETURNS TRIGGER AS $$
DECLARE
  sales_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sales_count
  FROM sales
  WHERE seller_id = OLD.id;
  
  IF sales_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete user with existing sales records. User has % sales.', sales_count;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_user_deletion_trigger ON users;
CREATE TRIGGER prevent_user_deletion_trigger
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_deletion_with_sales();

-- IMPROVEMENT 9: Add function to get inventory value
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_value()
RETURNS TABLE (
  category_name VARCHAR(100),
  total_units INTEGER,
  total_value DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    SUM(p.stock)::INTEGER as total_units,
    SUM(p.stock * p.cost)::DECIMAL(10,2) as total_value
  FROM categories c
  LEFT JOIN products p ON c.id = p.category_id
  GROUP BY c.id, c.name
  ORDER BY total_value DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 10: Add index for better query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_stock_low ON products(stock) WHERE stock <= 10;
CREATE INDEX IF NOT EXISTS idx_sales_date_seller ON sales(created_at, seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_composite ON sale_items(sale_id, product_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- IMPROVEMENT 11: Add better RLS policies for production
-- ============================================================
-- Note: These will replace the "Enable all operations" policies
-- Uncomment and customize when ready for production

/*
-- Example: Users can only see their own sales if not OWNER
DROP POLICY IF EXISTS "Enable all operations" ON sales;

CREATE POLICY "owners_see_all_sales" ON sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'OWNER'
    )
  );

CREATE POLICY "staff_see_own_sales" ON sales
  FOR SELECT
  USING (
    seller_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'OWNER'
    )
  );
*/

-- IMPROVEMENT 12: Add materialized view for dashboard stats (optional, for performance)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM products WHERE stock <= 5) as low_stock_products,
  (SELECT SUM(stock * cost) FROM products) as total_inventory_value,
  (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
  (SELECT COUNT(*) FROM sales WHERE created_at >= CURRENT_DATE) as today_sales,
  (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE created_at >= CURRENT_DATE) as today_revenue,
  (SELECT COUNT(*) FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_sales,
  (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_revenue,
  NOW() as last_updated;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_stats_unique ON dashboard_stats(last_updated);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- IMPROVEMENT 13: Add email column to users (for notifications)
-- ============================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Test low stock function
SELECT * FROM get_low_stock_products(10);

-- Test profit calculation
SELECT * FROM calculate_profit(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- Test seller performance
SELECT * FROM get_seller_performance(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE
);

-- Test inventory value
SELECT * FROM get_inventory_value();

-- Show all functions created
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname NOT LIKE 'pg_%'
ORDER BY p.proname;

SELECT 'Database improvements applied successfully!' as status;
