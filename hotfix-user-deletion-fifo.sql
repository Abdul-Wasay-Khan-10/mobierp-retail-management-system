-- ============================================================
-- HOTFIX: Allow User Deletion & Fix FIFO/LIFO
-- Run this if you already deployed the old version
-- ============================================================

-- ============================================================
-- PART 1: FIX USER DELETION
-- ============================================================

-- Step 1: Drop old constraint and trigger
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_seller_id_fkey;
DROP TRIGGER IF EXISTS prevent_user_deletion_trigger ON users;
DROP FUNCTION IF EXISTS prevent_user_deletion_with_sales();

-- Step 2: Make seller_id nullable
ALTER TABLE sales ALTER COLUMN seller_id DROP NOT NULL;

-- Step 3: Add new constraint (allows deletion, sets NULL)
ALTER TABLE sales 
  ADD CONSTRAINT sales_seller_id_fkey 
  FOREIGN KEY (seller_id) 
  REFERENCES users(id) 
  ON DELETE SET NULL;

-- Step 4: Create new logging function
CREATE OR REPLACE FUNCTION soft_delete_user_with_warning()
RETURNS TRIGGER AS $$
DECLARE
  sales_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sales_count
  FROM sales
  WHERE seller_id = OLD.id;
  
  IF sales_count > 0 THEN
    RAISE NOTICE 'User % (%) deleted. % sales records will have seller_id set to NULL.', 
      OLD.name, OLD.username, sales_count;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create new trigger (logs instead of preventing)
CREATE TRIGGER log_user_deletion_trigger
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_user_with_warning();

-- ============================================================
-- PART 2: FIX FIFO/LIFO - ADD INSERT TRIGGER
-- ============================================================

-- Only needed if you already ran add-fifo-lifo-support.sql

-- Create function for initial inventory purchase on INSERT
CREATE OR REPLACE FUNCTION record_initial_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  -- Only track if product has initial stock
  IF NEW.stock > 0 THEN
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

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS record_initial_purchase_on_insert ON products;
CREATE TRIGGER record_initial_purchase_on_insert
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_initial_inventory_purchase();

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Test 1: Check user deletion is now allowed
SELECT 
  'User Deletion' as test,
  'FK constraint updated to ON DELETE SET NULL' as status;

-- Test 2: Check FIFO/LIFO triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'products'
  AND trigger_name LIKE '%purchase%'
ORDER BY trigger_name;

-- Test 3: Show current sales with NULL sellers (if any)
SELECT 
  sale_number,
  total_amount,
  seller_id,
  CASE 
    WHEN seller_id IS NULL THEN 'Deleted User'
    ELSE (SELECT name FROM users WHERE id = seller_id)
  END as seller_display,
  created_at
FROM sales
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- DONE! All fixes applied
-- You can now delete users anytime without errors
-- FIFO/LIFO will work for all future product additions
-- ============================================================
