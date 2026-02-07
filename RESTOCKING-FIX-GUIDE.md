# Restocking Fix - Complete Guide

## Issue Summary
The restocking functionality (clicking the + icon to add stock) was failing with a database constraint violation: **"null value in column 'remaining_quantity' of relation 'inventory_purchases' violates not-null constraint"**

## Root Cause
Your system has database **triggers** (created by `add-inventory-valuation-methods.sql`) that automatically create `inventory_purchases` records whenever product stock changes. These trigger functions were missing the required `remaining_quantity` column in their INSERT statements, causing constraint violations.

The triggers fire on:
- Product creation with initial stock
- Product stock updates (including restocking)

## How to Fix

### Step 1: Apply the Trigger Fix
1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Run the SQL file: **`fix-inventory-triggers-fifo.sql`**
4. Verify you see "✅ Trigger functions updated successfully" in the results

### Step 2: Verify Prerequisites
Make sure the FIFO/LIFO tables exist. If you see "❌ inventory_purchases table missing":
1. First run: `add-fifo-lifo-support.sql`
2. Then run: `fix-add-product-stock-fifo.sql` again

### Step 3: Test the Fix
1. Refresh your application
2. Open the browser console (F12)
3. Click on any product's + icon in Inventory Management
4. Enter a quantity and click "Confirm Restock"
5. Check the console for success messages

## What Was Changed

### 1. Database Trigger Functions (`fix-inventory-triggers-fifo.sql`)
- **Fixed** `record_initial_inventory_purchase()` - For new products
- **Fixed** `record_inventory_purchase()` - For stock updates
- Both now properly include `remaining_quantity` column
- Sets `remaining_quantity = quantity` (all new stock starts as remaining)

### 2. Enhanced Service Layer (`services/supabase-db.ts`)
- Added current user retrieval for tracking
- Enhanced manual fallback to also create inventory_purchases records
- Improved error messages and logging
- Handles both RPC and manual update methods

### 3. Better User Feedback (`components/Inventory.tsx`)
- Added detailed console logging for debugging
- More informative error alerts with actual error messages
- Tracks the complete flow from button click to completion

### 4. Future-Proofed Base Files
- Updated `add-inventory-valuation-methods.sql` for future deployments
- Ensures new installations won't have this issue

## Technical Details

### The inventory_purchases Table
Your system uses the `inventory_purchases` table to track:
- When stock was purchased/added
- How much it cost per unit
- How many units remain (for FIFO/LIFO calculations)
- Who added the stock

### The Problematic Triggers
Two database triggers fire automatically on the `products` table:

1. **`record_initial_purchase_on_insert`** 
   - Fires AFTER INSERT on products
   - Creates inventory_purchases record for initial stock
   - Was missing `remaining_quantity` column

2. **`record_purchase_on_stock_increase`**
   - Fires AFTER UPDATE on products
   - Only when stock increases (NEW.stock > OLD.stock)
   - Creates inventory_purchases record for added stock
   - Was missing `remaining_quantity` column

### The Fix
Both trigger functions now include `remaining_quantity` in their INSERT statements:
- Sets `remaining_quantity = quantity` for new stock
- All units start as "remaining" (not yet sold)
- This satisfies the NOT NULL constraint on the column

## Troubleshooting

### Error: "null value in column 'remaining_quantity' violates not-null constraint"
✅ **This is the exact error this fix solves!**
- Run `fix-add-product-stock-fifo.sql` in Supabase SQL Editor
- Make sure `add-fifo-lifo-support.sql` was run previously
- Refresh your application and try again

### Error: "relation 'inventory_purchases' does not exist"
- Your database is missing the FIFO/LIFO tables
- First run: `add-fifo-lifo-support.sql`
- Then run: `fix-add-product-stock-fifo.sql`
- Finally refresh your application

### If the modal doesn't open:
- Check browser console for JavaScript errors
- Verify the product list is loading correctly
- Try refreshing the page

### If the modal opens but nothing happens:
1. Check the browser console for error messages
2. Look for:
   - "Failed to fetch product" - Database connection issue
   - "Product not found" - Product ID mismatch
   - "permission denied" - Check RLS policies in Supabase

### If you see "RPC function failed, trying manual update":
- This is normal - the fallback will work
- Both RPC and manual methods now create inventory_purchases records
- Check that manual update succeeds (watch console logs)

## Future Prevention

To prevent this issue when setting up new Supabase projects:

1. **Always sync database functions with schema changes**
   - When adding new tables (like `inventory_purchases`), update all related functions
   - Document dependencies between tables and functions

2. **Always add GRANT statements after creating functions:**
   ```sql
   GRANT EXECUTE ON FUNCTION function_name(...) TO authenticated, anon;
   ```

3. **Test related features after schema changes**
   - After adding FIFO/LIFO support, test stock additions
   - Check that all CRUD operations still work

4. **Use proper fallback strategies**
   - Implement manual fallbacks that handle all the same logic as RPC functions
   - Log warnings when fallbacks are used

## Related Files

- `add-inventory-valuation-methods.sql` - Created the inventory_purchases table and triggers
- `fix-inventory-triggers-fifo.sql` - ✅ **THE FIX** - Updates the trigger functions
- `add-fifo-lifo-support.sql` - Alternative FIFO/LIFO implementation
- `fix-add-product-stock-fifo.sql` - Alternative fix for RPC-based restocking
- `fix-restocking-permissions.sql` - Grants permissions (may still be needed)
- `production-schema.sql` - Main schema (consider adding these triggers here too)

## Additional Notes

- The fix includes both the RPC method (preferred) and a manual fallback
- If RPC fails, the system automatically tries direct table update
- All changes are backward compatible
- No data migration needed

## Need Help?

If you still experience issues:
1. Check the browser console (F12) for detailed error messages
2. Verify your Supabase connection is working (check other features)
3. Ensure you're logged in correctly
4. Check if other database operations work (adding products, categories)

---
**Last Updated:** Feb 7, 2026
**Status:** ✅ Fixed
