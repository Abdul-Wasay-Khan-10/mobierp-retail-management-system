# MobiERP - Retail Management System

Complete retail management system for Pakistani mobile phone shops with Supabase backend.

## 🚀 Features

- **Dynamic Pricing**: Set prices per sale, not fixed in inventory
- **Auto-SKU Generation**: Format `CAT-BRAND-DDMMYYYY-XXXX`
- **Financial Tracking**: Capital invested, revenue, profit analysis
- **Date Filtering**: Filter sales and reports by date range
- **Category Management**: Add custom product categories
- **Stock Management**: Track inventory with low stock alerts
- **Role-Based Access**: Owner and Staff user roles
- **Pakistani Rupees (Rs)**: All prices in PKR

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` file in project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Deploy Database Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste contents of `production-schema.sql`
4. Click **Run** to create all tables, functions, triggers, and seed data

**Note:** The setup includes test users automatically:

- **Owner:** username `hamza`, password `hamza123`
- **Staff:** username `staff`, password `staff123`

### 4. Run Development Server

```bash
npm run dev
```

App will be available at `http://localhost:5173`

## 📚 Database Schema

### Tables
- **categories**: Product categories
- **products**: Inventory items with auto-generated SKU
- **users**: System users with role-based access
- **sales**: Sales transactions
- **sale_items**: Line items for each sale
- **inventory_units**: Individual unit tracking (IMEI/Serial)
- **sku_counters**: Daily counter for SKU generation

### Key Features
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Auto-SKU generation function
- ✅ Automatic stock reduction on sales
- ✅ Profit analysis views
- ✅ Date-based filtering

## 🎯 Usage

### Login
- Username: `hamza` / Password: `hamza123` (Owner access)
- Username: `staff` / Password: `staff123` (Staff access)

### Adding Products
1. Go to **Inventory** tab
2. Click **Add Product**
3. Fill in category, brand, model, cost, and initial stock
4. SKU is auto-generated in format: `CAT-BRAND-DDMMYYYY-XXXX`

### Making Sales
1. Go to **POS** tab
2. Search for products
3. Click product to set selling price
4. Price modal shows cost and suggests 20% markup
5. Add to cart and complete sale

### Financial Reports
1. Go to **Finance** tab
2. Select date range
3. View revenue, profit, COGS
4. Analyze by category

## 🔐 Security Notes

⚠️ **Development Setup**: Current implementation uses plain text passwords for testing.

**For Production**:
1. Implement bcrypt password hashing
2. Update login function in `services/supabase-db.ts`
3. Hash passwords before storing in database
4. Configure proper RLS policies based on user roles

## 📁 Project Structure

```
├── components/
│   ├── Dashboard.tsx      # Business overview
│   ├── Inventory.tsx      # Product management
│   ├── POS.tsx            # Point of sale
│   ├── SalesHistory.tsx   # Transaction history
│   ├── Finance.tsx        # Financial reports
│   ├── Settings.tsx       # User settings
│   └── Layout.tsx         # App layout
├── services/
│   ├── supabase.ts        # Supabase client
│   ├── supabase-db.ts     # Database operations
│   └── supabase-config.ts # Supabase configuration
├── production-schema.sql  # Complete production DB setup
├── database-validation.sql # Optional validation queries
└── types.ts               # TypeScript interfaces
```

## 🆘 Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` file exists
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart dev server after adding env vars

### "Login failed"
- Verify `production-schema.sql` was executed successfully
- Check users table has data: `SELECT * FROM users;`
- Use credentials: hamza/hamza123 or staff/staff123
- Check username/password match exactly

### "Insufficient stock" error
- Add stock to products in Inventory tab
- Click **+** button next to product to add stock

### Empty Dashboard/No Data
- Database is empty by design (no hardcoded data)
- Add categories first, then products, then make sales
- All data comes from Supabase database

## 🎨 Customization

### Add New Categories
1. Go to Inventory tab
2. Click "Add Category"
3. Enter category name
4. Categories appear in product dropdown

### Modify SKU Format
Edit `generate_sku()` function in `production-schema.sql`

### Change Currency
Replace all `Rs` with your currency symbol throughout components

## 📝 License

Private project for Hamza ERP

## 🤝 Support

For issues or questions, contact the development team.
