-- ============================================================
-- FIX: Update inventory triggers to include remaining_quantity
-- ============================================================
-- This fixes triggers that create inventory_purchases records
-- to include the required remaining_quantity column
-- ============================================================

-- Fix the trigger function for INITIAL product creation
CREATE OR REPLACE FUNCTION record_initial_inventory_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Record initial purchase for valuation tracking
  IF NEW.stock > 0 THEN
    INSERT INTO inventory_purchases (
      product_id,
      quantity,
      unit_cost,
      remaining_quantity,  -- Added this required field
      purchased_at,
      notes
    ) VALUES (
      NEW.id,
      NEW.stock,
      NEW.cost,
      NEW.stock,  -- Initially all stock is remaining
      NEW.created_at,
      'Initial inventory - product created'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix the trigger function for STOCK UPDATES
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
      remaining_quantity,  -- Added this required field
      purchased_at,
      notes
    ) VALUES (
      NEW.id,
      v_quantity_added,
      NEW.cost,
      v_quantity_added,  -- Initially all added stock is remaining
      NOW(),
      'Stock added via inventory update'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_initial_inventory_purchase() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_inventory_purchase() TO authenticated, anon;

-- ============================================================
-- VERIFY THE FIX
-- ============================================================

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'record_inventory_purchase'
    )
    THEN '✅ Trigger functions updated successfully'
    ELSE '❌ Trigger functions not found'
  END as status;

-- ============================================================
-- INSTRUCTIONS:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. This fixes the triggers that were missing remaining_quantity
-- 3. After running, refresh your app and test restocking
-- ============================================================
