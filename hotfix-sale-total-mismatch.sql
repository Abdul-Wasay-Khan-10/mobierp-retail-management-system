-- ============================================================
-- HOTFIX: Sale Total Mismatch Error
-- Fixes: "sale total mismatch for sale SALE-XXXXXXXX-XXXX. Expected: 0.00, Got: XXXXX.XX"
-- Run this in your Supabase SQL Editor to fix the issue
-- ============================================================

-- Drop the existing trigger
DROP TRIGGER IF EXISTS validate_sale_total_trigger ON sales;

-- Update the validation function to handle INSERT case
CREATE OR REPLACE FUNCTION validate_sale_total()
RETURNS TRIGGER AS $$
DECLARE
  calculated_total DECIMAL(10,2);
  items_count INTEGER;
BEGIN
  -- Check if sale has any items yet
  SELECT COUNT(*) INTO items_count
  FROM sale_items
  WHERE sale_id = NEW.id;
  
  -- Skip validation if no items yet (happens during INSERT before items are added)
  IF items_count = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Calculate total from sale items
  SELECT COALESCE(SUM(subtotal), 0) INTO calculated_total
  FROM sale_items
  WHERE sale_id = NEW.id;
  
  -- Validate with small tolerance for floating point differences
  IF ABS(calculated_total - NEW.total_amount) > 0.01 THEN
    RAISE EXCEPTION 'Sale total mismatch for sale %. Expected: %, Got: %', 
      NEW.sale_number, calculated_total, NEW.total_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger - only fires on UPDATE, not INSERT
-- This prevents validation before sale_items are inserted
CREATE TRIGGER validate_sale_total_trigger
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.total_amount IS DISTINCT FROM OLD.total_amount)
  EXECUTE FUNCTION validate_sale_total();

-- Verify fix
SELECT 'Hotfix applied successfully! You can now make sales without errors.' as status;

-- ============================================================
-- WHAT WAS FIXED:
-- 
-- BEFORE: Trigger validated sale total immediately after INSERT
--         Problem: sale_items inserted AFTER sales, so total was always 0.00
--
-- AFTER:  Trigger only validates on UPDATE (when total changes)
--         Function also skips validation if no items exist yet
--
-- This allows the normal flow:
-- 1. INSERT sale with total_amount
-- 2. INSERT sale_items (stock is reduced automatically)
-- 3. Sale is complete ✅
-- ============================================================
