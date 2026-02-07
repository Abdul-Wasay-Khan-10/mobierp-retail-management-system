-- ============================================================
-- FIX: Update add_product_stock function to support FIFO/LIFO
-- ============================================================
-- This fixes the restocking issue where adding stock fails because
-- the function doesn't create inventory_purchases records
-- ============================================================

-- Drop existing function versions with specific signatures
-- The CASCADE ensures any dependencies are handled
DROP FUNCTION IF EXISTS add_product_stock(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS add_product_stock(UUID, INTEGER, UUID) CASCADE;

-- Create the new function with FIFO/LIFO support
CREATE OR REPLACE FUNCTION add_product_stock(
  p_product_id UUID,
  p_additional_stock INTEGER,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_product RECORD;
BEGIN
  -- Validate input
  IF p_additional_stock <= 0 THEN
    RAISE EXCEPTION 'Cannot add zero or negative stock';
  END IF;
  
  -- Get product details
  SELECT id, cost, stock INTO v_product
  FROM products
  WHERE id = p_product_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or inactive: %', p_product_id;
  END IF;
  
  -- Update product stock
  UPDATE products 
  SET stock = stock + p_additional_stock,
      updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Create inventory purchase record for FIFO/LIFO tracking
  -- Only if the inventory_purchases table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'inventory_purchases'
  ) THEN
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      remaining_quantity,
      purchased_at,
      purchased_by,
      notes
    ) VALUES (
      p_product_id,
      p_additional_stock,
      v_product.cost,
      p_additional_stock,  -- Initially all units are remaining
      NOW(),
      p_user_id,
      'Stock added via inventory management'
    );
  END IF;
  
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_stock IS 'Adds stock to product and creates inventory purchase record for FIFO/LIFO tracking';

-- Grant permissions for both function signatures
GRANT EXECUTE ON FUNCTION add_product_stock(UUID, INTEGER, UUID) TO authenticated, anon;

-- ============================================================
-- VERIFY THE FIX
-- ============================================================

-- Check if table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_purchases')
    THEN '✅ inventory_purchases table exists'
    ELSE '❌ inventory_purchases table missing - run add-fifo-lifo-support.sql first'
  END as table_status;

-- Check if function exists
SELECT 
  routine_name,
  routine_type,
  '✅ Function updated successfully' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'add_product_stock'
  AND routine_type = 'FUNCTION';

-- ============================================================
-- INSTRUCTIONS:
-- 1. Make sure add-fifo-lifo-support.sql was run before this
-- 2. Run this SQL in your Supabase SQL Editor
-- 3. The restocking functionality should now work properly
-- 4. Test by clicking the + icon on any product in Inventory
-- ============================================================
