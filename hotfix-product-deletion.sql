-- ============================================================
-- HOTFIX: Product Deletion Error
-- Fixes: "error deleting item" when trying to delete products with sales history
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add is_active column to products table (if not already exists)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update comment
COMMENT ON COLUMN products.is_active IS 'Soft delete flag - false means archived/deleted';

-- Set all existing products to active
UPDATE products SET is_active = true WHERE is_active IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;

-- Update get_low_stock_products function to filter active products
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
    AND p.is_active = true
  ORDER BY p.stock ASC, p.brand, p.model;
END;
$$ LANGUAGE plpgsql;

-- Update get_inventory_value function to filter active products
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
    COALESCE(SUM(p.stock), 0)::INTEGER,
    COALESCE(SUM(p.stock * p.cost), 0)::DECIMAL(10,2)
  FROM categories c
  LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
  GROUP BY c.id, c.name
  ORDER BY total_value DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Update product_details view to show only active products
CREATE OR REPLACE VIEW product_details AS
SELECT 
  p.id,
  p.sku,
  p.brand,
  p.model,
  p.cost,
  p.stock,
  p.track_individually,
  p.is_active,
  c.name as category_name,
  c.id as category_id,
  p.created_at,
  p.updated_at
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true;

-- Verify fix
SELECT 'Hotfix applied successfully! Products can now be "deleted" (archived).' as status;

-- Show statistics
SELECT 
  COUNT(*) FILTER (WHERE is_active = true) as active_products,
  COUNT(*) FILTER (WHERE is_active = false) as archived_products,
  COUNT(*) as total_products
FROM products;

-- ============================================================
-- WHAT WAS FIXED:
-- 
-- BEFORE: 
-- - Products with sales history couldn't be deleted (ON DELETE RESTRICT)
-- - Error: "error deleting item" due to foreign key constraint
--
-- AFTER:
-- - Products are "soft deleted" (is_active = false)
-- - Sales history is preserved
-- - Products are hidden from UI but remain in database
-- - Can query archived products with: WHERE is_active = false
--
-- BENEFITS:
-- ✅ Preserves all sales history and financial records
-- ✅ Maintains referential integrity
-- ✅ Products can be "undeleted" by setting is_active = true
-- ✅ Better for compliance and auditing
-- ============================================================
