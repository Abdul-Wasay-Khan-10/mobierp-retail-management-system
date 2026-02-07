-- ============================================================
-- FIX: Grant execution permissions for RPC functions
-- ============================================================
-- NOTE: This file grants permissions only. If you're experiencing
-- the "remaining_quantity" constraint violation error, you need
-- to run fix-add-product-stock-fifo.sql instead!
-- ============================================================

-- Grant execute permissions on all functions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION add_product_stock(UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_product_stock(UUID, INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_sku(VARCHAR, VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_and_reduce_stock() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_low_stock_products(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_profit(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, anon;

-- Verify the permissions were applied
SELECT 
  routine_name,
  routine_type,
  'Permissions updated' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================================
-- INSTRUCTIONS:
-- 
-- If you see this error:
--   "null value in column 'remaining_quantity' violates not-null constraint"
-- 
-- YOU NEED: fix-add-product-stock-fifo.sql (not this file!)
-- 
-- This file only grants permissions. Use it if you see permission errors.
-- For the constraint violation error, run fix-add-product-stock-fifo.sql
-- ============================================================
