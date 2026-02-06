<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MobiERP - Retail Management System

Production-ready retail management system for mobile phone shops with Supabase backend.

## Quick Start

**Prerequisites:** Node.js 18+, Supabase account

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables** (create `.env.local`):
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Deploy database:**
   - Open Supabase SQL Editor
   - Run `production-schema.sql` (complete setup with tables, functions, triggers, RLS, seed data)

4. **Run the app:**
   ```bash
   npm run dev
   ```

5. **Login:**
   - Username: `hamza` / Password: `hamza123` (Owner)
   - Username: `staff` / Password: `staff123` (Staff)

**Note**: After running `production-schema.sql`, always **logout and login again** to refresh your session!

## ⚠️ Troubleshooting

Having issues? See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common problems and solutions.

## Features

✅ Dynamic pricing per sale  
✅ Auto-SKU generation  
✅ Stock management with validations  
✅ Financial tracking & profit analysis  
✅ Role-based access control  
✅ Complete CRUD operations with security  

## Database Files

- `production-schema.sql` - Complete production setup (✅ use this)
- `database-validation.sql` - Optional validation queries
- `hotfix-sale-total-mismatch.sql` - Fix for sale total validation error
- `hotfix-product-deletion.sql` - Fix for product deletion error (soft delete)
- `fix-user-session.sql` - Fix for foreign key constraint error

See [SETUP-GUIDE.md](SETUP-GUIDE.md) for detailed instructions.
