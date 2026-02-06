# 🔧 Troubleshooting: Common Errors & Solutions

## 🚨 Error 1: Foreign Key Constraint (sales_seller_id_fkey)

### Error Message
```
insert or update on table "sales" violates foreign key constraint "sales_seller_id_fkey"
```

### 🎯 Root Cause
After running `production-schema.sql` to recreate tables, new UUIDs were generated for users. However, your browser's localStorage still has the **old user ID** from your previous login session. When making a sale, it tries to use this outdated ID, which doesn't exist in the database anymore.

## ✅ Quick Fix (3 Steps)

### Step 1: Verify Users Exist in Database
1. Open Supabase SQL Editor
2. Run `fix-user-session.sql` (or just this query):
```sql
SELECT id, username, name, role FROM users;
```
3. Confirm you see both `hamza` and `staff` users

### Step 2: Refresh Your Session
**IMPORTANT**: In your application:
1. Click the **LOGOUT** button
2. **Login again** with: 
   - Username: `hamza`
   - Password: `hamza123`

### Step 3: Try Making a Sale Again
Your session now has the correct user ID from the database!

---

## � Error 2: Sale Total Mismatch

### Error Message
```
sale total mismatch for sale SALE-07022026-0001. Expected: 0.00, Got: 10000.00
```

### 🎯 Root Cause
The `validate_sale_total` trigger was firing AFTER INSERT on the sales table, but at that moment the sale_items haven't been inserted yet, so it calculated 0.00 vs the actual total.

### ✅ Quick Fix

**Option 1: Run Hotfix SQL** (Recommended - preserves existing data)
1. Open Supabase SQL Editor
2. Run `hotfix-sale-total-mismatch.sql`
3. Try making a sale again ✅

**Option 2: Recreate Database** (if you have no important data)
1. Run the updated `production-schema.sql`
2. Remember to logout and login again

### 🛡️ What Was Fixed

**Before**:
```
1. INSERT sale (total: 10000)
2. Trigger validates → checks sale_items → finds 0 items → total = 0.00
3. ❌ Error: Expected 0.00, Got 10000.00
```

**After**:
```
1. INSERT sale (total: 10000)
2. Trigger skipped for INSERT (no validation yet)
3. INSERT sale_items → stock reduced automatically
4. ✅ Sale complete!
```

The trigger now only validates on UPDATE (when totals change), not on initial INSERT.

---

## � Error 3: Cannot Delete Product

### Error Message
```
error deleting item
```

### 🎯 Root Cause
Products that have been sold (exist in `sale_items` table) cannot be deleted due to foreign key constraint `ON DELETE RESTRICT`. This protects your sales history and financial records.

### Example
- Buy 10 phones → add to inventory
- Sell 1 phone → 9 remaining in stock
- Try to delete product → ❌ Error (because 1 sale exists)

### ✅ Solution Implemented: Soft Delete

Products are now **archived** instead of deleted:

**Option 1: Run Hotfix SQL** (Recommended - if database already exists)
1. Open Supabase SQL Editor
2. Run `hotfix-product-deletion.sql`
3. Products will now "delete" successfully (they're archived)

**Option 2: Recreate Database**
1. Run the updated `production-schema.sql`
2. Remember to logout/login after

### 🛡️ How It Works Now

**Before** (Hard Delete):
```
1. Product has sales history
2. Try DELETE from products
3. ❌ Foreign key constraint violated
```

**After** (Soft Delete):
```
1. Product has sales history
2. Click delete → SET is_active = false
3. ✅ Product archived (hidden from UI)
4. Sales history preserved intact
```

### 💡 Benefits
- ✅ Preserves all sales history
- ✅ Financial records remain intact  
- ✅ Can "undelete" products if needed
- ✅ Better for auditing and compliance
- ✅ No more deletion errors!

---

## 🔍 Error 4: Insufficient Stock

### Code Improvements Made:

1. **Added Seller Validation** (`services/supabase-db.ts`)
   - Before inserting a sale, we now verify the seller exists
   - Provides clear error message: "Invalid seller ID. Please log out and log back in."

2. **Added Session Verification** (`App.tsx`)
   - On app load, verifies current user still exists in database
   - Automatically logs out if user ID is invalid
   - Shows message: "Session expired. Please log in again."

3. **Added verifyCurrentUser Function** (`services/supabase-db.ts`)
   - Checks if localStorage user ID exists in database
   - Cleans up invalid sessions automatically

### SQL Schema Update:
- Added comment in `production-schema.sql` to remind users to logout/login after running the script

---

## 🔄 Why This Happened

```
Old Flow (Bug):
1. Login → Store user ID (e.g., "abc123") in localStorage
2. Run production-schema.sql → DROP and recreate tables
3. New users created with NEW IDs (e.g., "xyz789")
4. Make sale → Uses OLD ID "abc123" from localStorage
5. ❌ Error: "abc123" doesn't exist in users table

New Flow (Fixed):
1. Login → Store user ID in localStorage
2. Run production-schema.sql → DROP and recreate tables
3. App checks → Verifies user ID against database
4. ❌ Invalid → Auto-logout, show error message
5. Login again → Get NEW ID "xyz789"
6. Make sale → Uses VALID ID "xyz789"
7. ✅ Success!
```

---

## 🎓 Prevention Tips

### Always do this after recreating tables:
1. ✅ Run your SQL schema
2. ✅ **Logout** from the app
3. ✅ **Login** again
4. ✅ Test functionality

### For Development:
- Clear browser localStorage when testing schemas: `localStorage.clear()`
- Or use browser's "Clear Site Data" in DevTools

---

## 🧪 Verify Everything Works

Run this in Supabase SQL Editor:
```sql
-- Check users
SELECT id, username, name FROM users;

-- Check if you have any orphaned sales (shouldn't be any)
SELECT s.id, s.sale_number, s.seller_id, u.username
FROM sales s
LEFT JOIN users u ON s.seller_id = u.id
WHERE u.id IS NULL;
```

---

## 📞 Still Having Issues?

1. **Clear Browser Data**:
   - Open DevTools (F12)
   - Application → Storage → Clear Site Data

2. **Verify Database Connection**:
   - Check `.env.local` has correct Supabase credentials
   - Test with: `SELECT COUNT(*) FROM users;` in SQL Editor

3. **Check Console Logs**:
   - Open browser DevTools → Console
   - Look for error messages when making sale

---

## ✨ Summary

### Error 1 - Foreign Key Constraint:
- ✅ Invalid user sessions are detected and cleared automatically
- ✅ Clear error messages guide you to log out/in
- ✅ Seller ID is validated before creating sales

### Error 2 - Sale Total Mismatch:
- ✅ Trigger now skips validation during INSERT
- ✅ Only validates on UPDATE (when totals change)
- ✅ Sale items insert properly before validation

### Error 3 - Cannot Delete Product:
- ✅ Products are now "soft deleted" (archived)
- ✅ Sales history and financial records preserved
- ✅ Products can be undeleted if needed
- ✅ No more foreign key constraint errors on deletion

**Remember**: After running `production-schema.sql`, always **logout and login** to refresh your session! 🔄
