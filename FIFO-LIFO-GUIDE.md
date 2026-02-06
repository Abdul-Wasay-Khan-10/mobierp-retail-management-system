# FIFO/LIFO Inventory Costing - Implementation Guide

## Overview
Your MobiERP system now supports **three inventory costing methods** to accurately calculate product costs when making sales:

1. **FIFO** (First In, First Out) - Default
2. **LIFO** (Last In, First Out)
3. **AVERAGE** (Weighted Average Cost)

## How It Works

### Backend (Database)
- **New Table: `system_settings`** - Stores the selected costing method
- **New Table: `inventory_purchases`** - Tracks each stock purchase with cost and date
- **Smart Functions**: Automatically calculate cost based on selected method when selling

### When You Add Stock
Every time you add stock to a product, the system records:
- Quantity added
- Cost per unit at that time
- Date of purchase
- How many units remain unsold

### When You Make a Sale
The system automatically:
1. Checks your selected costing method (FIFO/LIFO/AVERAGE)
2. Calculates the cost based on that method
3. Updates which purchase batches were sold from
4. Records accurate profit margins

## Costing Methods Explained

### FIFO (First In, First Out) ✅ Recommended
- **Logic**: Oldest inventory is sold first
- **Example**: 
  - Feb 1: Buy 10 phones @ Rs 15,000 each
  - Feb 5: Buy 10 phones @ Rs 16,000 each
  - Feb 7: Sell 8 phones → Uses Rs 15,000 cost (from Feb 1 batch)
- **Best For**: Most businesses, real-world inventory flow, accurate profit tracking
- **Benefits**: Matches physical inventory movement, lower taxes when costs are rising

### LIFO (Last In, First Out)
- **Logic**: Newest inventory is sold first
- **Example**:
  - Feb 1: Buy 10 phones @ Rs 15,000 each
  - Feb 5: Buy 10 phones @ Rs 16,000 each
  - Feb 7: Sell 8 phones → Uses Rs 16,000 cost (from Feb 5 batch)
- **Best For**: Businesses wanting to match current costs with revenue
- **Benefits**: Better matches current market costs, higher tax deductions when costs are rising

### AVERAGE Cost
- **Logic**: Uses weighted average of all available inventory
- **Example**:
  - Feb 1: Buy 10 phones @ Rs 15,000 each = Rs 150,000
  - Feb 5: Buy 10 phones @ Rs 16,000 each = Rs 160,000
  - Average: Rs 310,000 ÷ 20 units = Rs 15,500 per unit
  - Feb 7: Sell 8 phones → Uses Rs 15,500 cost
- **Best For**: Businesses wanting simplicity and consistency
- **Benefits**: Smooths out cost fluctuations, simple to understand

## Setup Instructions

### 1. Run Database Migration
```sql
-- In Supabase SQL Editor, run:
-- File: add-fifo-lifo-support.sql
```

This creates:
- Settings table with default FIFO method
- Purchase tracking table
- Automated cost calculation functions
- Triggers to record purchases and calculate costs

### 2. Migrate Existing Inventory
The script automatically creates purchase records for your existing products, using:
- Current stock as quantity
- Current cost as unit cost
- Product creation date as purchase date

### 3. Select Your Method
1. Go to **Settings** page in the app
2. Find **"Inventory Costing Method"** section (top of page)
3. Click on your preferred method:
   - FIFO (First In, First Out) - **Recommended**
   - LIFO (Last In, First Out)
   - AVERAGE (Weighted Average)
4. Confirmation alert shows success

## How Each Operation Works

### Adding New Products
When you add a new product with initial stock:
- Product created with cost and stock
- Purchase record automatically created
- Ready for FIFO/LIFO calculations

### Adding Stock to Existing Product
When you increase stock (e.g., from 10 to 25):
- Automatically records new purchase of 15 units
- Captures current cost at time of addition
- Links to product for costing calculations

### Making a Sale
When a customer buys a product:
1. System checks selected costing method
2. Calculates cost from appropriate purchase batches:
   - **FIFO**: Takes from oldest purchase first
   - **LIFO**: Takes from newest purchase first
   - **AVERAGE**: Uses weighted average of all batches
3. Records sale with calculated cost
4. Updates remaining quantities in purchase batches
5. Reduces total stock

### Example Sale Flow (FIFO)

**Inventory State:**
```
Product: Samsung Galaxy S23
Purchase 1: Feb 1, 2026 - 5 units @ Rs 80,000 (3 remaining)
Purchase 2: Feb 15, 2026 - 10 units @ Rs 82,000 (10 remaining)
Purchase 3: Feb 20, 2026 - 8 units @ Rs 81,500 (8 remaining)
Total Stock: 21 units
```

**Customer buys 5 units on Feb 25:**

With FIFO selected:
- Takes 3 units from Purchase 1 @ Rs 80,000 = Rs 240,000
- Takes 2 units from Purchase 2 @ Rs 82,000 = Rs 164,000
- **Total Cost: Rs 404,000 (Rs 80,800 average per unit)**
- Sells at Rs 95,000 each = Rs 475,000 revenue
- **Profit: Rs 71,000**

**Updated Inventory:**
```
Purchase 1: DEPLETED
Purchase 2: Feb 15, 2026 - 10 units @ Rs 82,000 (8 remaining)
Purchase 3: Feb 20, 2026 - 8 units @ Rs 81,500 (8 remaining)
Total Stock: 16 units
```

## Important Notes

### ⚠️ Warnings
1. **Changing Method**: 
   - Only affects FUTURE sales
   - Existing sales keep their recorded costs
   - Changes immediately, no delay

2. **Stock Must Match**:
   - Always add stock through "Add Stock" feature
   - Manual database edits may break tracking
   - System validates purchase batches exist

3. **Cannot Oversell**:
   - System prevents selling more than available
   - Checks both total stock AND purchase batches
   - Error if purchase history insufficient

### ✅ Best Practices

1. **Choose Once**: Pick your method and stick with it for consistency
2. **FIFO Default**: Use FIFO unless you have specific accounting needs
3. **Record Purchases**: Always add stock through the app, not directly in database
4. **Review Reports**: Check profit margins to see impact of costing method
5. **Audit Trail**: All purchase history is preserved for accounting

## Verification

### Check Current Method
```sql
SELECT setting_value as method
FROM system_settings
WHERE setting_key = 'inventory_costing_method';
```

### View Purchase History
```sql
SELECT 
  p.sku,
  p.brand,
  p.model,
  ip.quantity,
  ip.remaining_quantity,
  ip.unit_cost,
  ip.purchased_at
FROM inventory_purchases ip
JOIN products p ON ip.product_id = p.id
WHERE ip.remaining_quantity > 0
ORDER BY p.brand, ip.purchased_at;
```

### Test Cost Calculation
```sql
-- Calculate cost for selling 5 units of a product
SELECT calculate_sale_cost(
  'PRODUCT-UUID-HERE'::UUID,
  5
) as calculated_cost;
```

## Troubleshooting

### Issue: "Insufficient inventory to allocate"
**Cause**: Purchase history doesn't match current stock
**Fix**: 
```sql
-- Reset purchase for product
DELETE FROM inventory_purchases WHERE product_id = 'PRODUCT-UUID';
INSERT INTO inventory_purchases (product_id, quantity, unit_cost, remaining_quantity)
SELECT id, stock, cost, stock FROM products WHERE id = 'PRODUCT-UUID';
```

### Issue: Costs seem wrong
**Cause**: Wrong costing method selected
**Solution**: Go to Settings and verify method is correct

### Issue: Old sales show different costs
**Expected**: Old sales keep their original costs, new method only affects future sales

## Files Modified/Created

1. **add-fifo-lifo-support.sql** - Database migration script
2. **types.ts** - Added `InventoryMethod` enum
3. **services/supabase-db.ts** - Added `getInventoryMethod()` and `setInventoryMethod()` functions
4. **components/Settings.tsx** - Added inventory method selection UI

## Summary

You now have professional-grade inventory costing with full FIFO/LIFO/AVERAGE support. The system:
- ✅ Tracks every purchase with cost and date
- ✅ Calculates accurate costs based on your chosen method
- ✅ Updates automatically when you change methods
- ✅ Preserves complete audit trail
- ✅ Provides accurate profit analysis

**Recommended: Use FIFO** for most retail businesses as it matches physical inventory flow and provides accurate profit tracking.
