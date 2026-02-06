# Inventory Display Order (FIFO/LIFO)

## What This Does

This feature controls **how products are sorted** in the Inventory page:
- **FIFO (First In, First Out)**: Oldest products appear first (sorted by creation date ascending)
- **LIFO (Last In, First Out)**: Newest products appear first (sorted by creation date descending)

## What This Does NOT Do

- ❌ Does NOT affect sales calculations
- ❌ Does NOT affect financial reports
- ❌ Does NOT affect inventory valuation
- ❌ Does NOT affect dashboards
- ✅ ONLY affects the sort order of products in the Inventory listing

## Setup Instructions

1. **Run the SQL setup file:**
   ```sql
   -- In Supabase SQL editor
   -- Execute: add-inventory-display-order.sql
   ```

2. **Files Modified:**
   - `add-inventory-display-order.sql` - Creates system_settings table and setting
   - `services/supabase-db.ts` - Added getInventoryDisplayOrder() and setInventoryDisplayOrder()
   - `components/Settings.tsx` - Added UI to toggle between FIFO/LIFO
   - `components/Inventory.tsx` - No changes needed (automatically uses new sort)

## How It Works

1. **Database**: `system_settings` table stores the preference:
   ```
   setting_key: 'inventory_display_order'
   setting_value: 'FIFO' or 'LIFO'
   ```

2. **Backend**: `getProducts()` function checks the setting and sorts accordingly:
   ```typescript
   const displayOrder = await getInventoryDisplayOrder();
   const ascending = displayOrder === 'FIFO'; // FIFO = oldest first
   .order('created_at', { ascending });
   ```

3. **Frontend**: Settings page provides a toggle to switch between FIFO and LIFO

## Usage

1. Go to **Settings** page
2. Find **Inventory Display Order** section
3. Click on either:
   - **FIFO**: To show oldest products first
   - **LIFO**: To show newest products first
4. Products in Inventory page will immediately reflect the new sort order on next refresh

## Default Behavior

- Default is **LIFO** (newest first)
- If setting is not found, defaults to LIFO

## Technical Details

- Setting is stored globally in `system_settings` table
- Works across all users (system-wide preference)
- No impact on sales, profit calculations, or reports
- Simple ORDER BY change in SQL query
