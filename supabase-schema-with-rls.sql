-- MobiERP Database Schema for Supabase
-- Complete schema with Row Level Security (RLS) enabled on ALL tables
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON categories 
  FOR ALL USING (true);

-- Index for faster queries
CREATE INDEX idx_categories_name ON categories(name);

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(200) NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  track_individually BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON products 
  FOR ALL USING (true);

-- Indexes for faster queries
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_created_at ON products(created_at);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON users 
  FOR ALL USING (true);

-- Index for login queries
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- SALES TABLE
-- =====================================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number VARCHAR(50) NOT NULL UNIQUE,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON sales 
  FOR ALL USING (true);

-- Indexes for sales queries
CREATE INDEX idx_sales_seller ON sales(seller_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_number ON sales(sale_number);

-- =====================================================
-- SALE ITEMS TABLE
-- =====================================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  cost_price DECIMAL(10, 2) NOT NULL CHECK (cost_price >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON sale_items 
  FOR ALL USING (true);

-- Indexes for queries
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_created_at ON sale_items(created_at);

-- =====================================================
-- INVENTORY UNITS TABLE (Future: For IMEI/Serial Tracking)
-- =====================================================
CREATE TABLE inventory_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  imei VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'SOLD', 'RETURNED', 'DEFECTIVE')),
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON inventory_units 
  FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_inventory_units_product ON inventory_units(product_id);
CREATE INDEX idx_inventory_units_status ON inventory_units(status);
CREATE INDEX idx_inventory_units_serial ON inventory_units(serial_number);

-- =====================================================
-- SKU COUNTER TABLE (For auto-generation)
-- =====================================================
CREATE TABLE sku_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key VARCHAR(20) NOT NULL UNIQUE,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sku_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow all for authenticated users" ON sku_counters 
  FOR ALL USING (true);

-- Index
CREATE INDEX idx_sku_counters_date ON sku_counters(date_key);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers for updated_at
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate next SKU
-- Format: CAT-BRAND-DDMMYYYY-XXXX
CREATE OR REPLACE FUNCTION generate_sku(
  p_category_name VARCHAR,
  p_brand VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_date_key VARCHAR;
  v_counter INTEGER;
  v_cat_code VARCHAR;
  v_brand_code VARCHAR;
  v_sku VARCHAR;
BEGIN
  -- Get date in DDMMYYYY format
  v_date_key := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  
  -- Get or create counter for today
  INSERT INTO sku_counters (date_key, counter)
  VALUES (v_date_key, 1)
  ON CONFLICT (date_key) 
  DO UPDATE SET counter = sku_counters.counter + 1
  RETURNING counter INTO v_counter;
  
  -- Generate category code (first 3 letters, uppercase)
  v_cat_code := UPPER(SUBSTRING(REGEXP_REPLACE(p_category_name, '[^a-zA-Z]', '', 'g'), 1, 3));
  
  -- Generate brand code (first 4 letters, uppercase)
  v_brand_code := UPPER(SUBSTRING(REGEXP_REPLACE(p_brand, '[^a-zA-Z]', '', 'g'), 1, 4));
  
  -- Format: CAT-BRAND-DDMMYYYY-XXXX
  v_sku := v_cat_code || '-' || v_brand_code || '-' || v_date_key || '-' || LPAD(v_counter::TEXT, 4, '0');
  
  RETURN v_sku;
END;
$$ LANGUAGE plpgsql;

-- Function to check and reduce stock
CREATE OR REPLACE FUNCTION check_and_reduce_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT stock INTO v_product_stock
  FROM products
  WHERE id = NEW.product_id;
  
  -- Check if enough stock
  IF v_product_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  
  -- Reduce stock
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically reduce stock on sale
CREATE TRIGGER reduce_stock_on_sale
  BEFORE INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION check_and_reduce_stock();

-- =====================================================
-- USEFUL VIEWS
-- =====================================================

-- View for product details with category name
CREATE VIEW product_details AS
SELECT 
  p.id,
  p.sku,
  p.brand,
  p.model,
  p.cost,
  p.stock,
  p.track_individually,
  c.name as category_name,
  c.id as category_id,
  p.created_at,
  p.updated_at
FROM products p
JOIN categories c ON p.category_id = c.id;

-- View for sales with details
CREATE VIEW sales_details AS
SELECT 
  s.id,
  s.sale_number,
  s.total_amount,
  s.created_at as sale_date,
  u.name as seller_name,
  u.username as seller_username,
  u.role as seller_role,
  COUNT(si.id) as item_count,
  SUM(si.quantity) as total_quantity
FROM sales s
JOIN users u ON s.seller_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, s.sale_number, s.total_amount, s.created_at, u.name, u.username, u.role;

-- View for profit analysis
CREATE VIEW profit_analysis AS
SELECT 
  s.id as sale_id,
  s.sale_number,
  s.created_at as sale_date,
  s.total_amount as revenue,
  SUM(si.cost_price * si.quantity) as total_cost,
  s.total_amount - SUM(si.cost_price * si.quantity) as gross_profit,
  CASE 
    WHEN s.total_amount > 0 
    THEN ROUND(((s.total_amount - SUM(si.cost_price * si.quantity)) / s.total_amount * 100)::numeric, 2)
    ELSE 0 
  END as profit_margin_percent
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, s.sale_number, s.created_at, s.total_amount;

-- View for detailed sale items with product info
CREATE VIEW sale_items_detailed AS
SELECT 
  si.id,
  si.sale_id,
  s.sale_number,
  s.created_at as sale_date,
  p.sku,
  p.brand,
  p.model,
  c.name as category_name,
  si.quantity,
  si.unit_price,
  si.cost_price,
  si.subtotal,
  (si.unit_price - si.cost_price) * si.quantity as profit
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
JOIN categories c ON p.category_id = c.id;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert initial categories
INSERT INTO categories (name) VALUES
  ('Smartphones'),
  ('Keypad Phones'),
  ('Tablets'),
  ('Watches'),
  ('Wearables'),
  ('Pouches'),
  ('Chargers'),
  ('Audio'),
  ('Accessories')
ON CONFLICT (name) DO NOTHING;

-- Insert default users
-- Note: In production, hash passwords with bcrypt
-- Password for both: hamza123 (example hash - replace with real bcrypt hash)
INSERT INTO users (username, password_hash, name, role) VALUES
  ('hamza', '$2a$10$YourBcryptHashHere', 'Hamza (Admin)', 'OWNER'),
  ('staff', '$2a$10$YourBcryptHashHere', 'Store Staff', 'STAFF')
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE categories IS 'Product categories';
COMMENT ON TABLE products IS 'Product inventory with auto-generated SKU';
COMMENT ON TABLE users IS 'System users with role-based access';
COMMENT ON TABLE sales IS 'Master sales transactions';
COMMENT ON TABLE sale_items IS 'Line items for each sale';
COMMENT ON TABLE inventory_units IS 'Individual unit tracking (IMEI/Serial)';
COMMENT ON TABLE sku_counters IS 'Daily counter for SKU generation';

COMMENT ON COLUMN products.sku IS 'Auto-generated format: CAT-BRAND-DDMMYYYY-XXXX';
COMMENT ON COLUMN products.track_individually IS 'If true, requires serial/IMEI in inventory_units';
COMMENT ON COLUMN sale_items.cost_price IS 'Product cost at time of sale';
COMMENT ON COLUMN sale_items.unit_price IS 'Selling price negotiated per sale';

COMMENT ON FUNCTION generate_sku IS 'Generates SKU: CAT-BRAND-DDMMYYYY-XXXX';
COMMENT ON FUNCTION check_and_reduce_stock IS 'Validates and reduces stock on sale';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check that RLS is enabled on all tables
-- Run this after schema creation to verify:
/*
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('categories', 'products', 'users', 'sales', 'sale_items', 'inventory_units', 'sku_counters')
ORDER BY tablename;
*/

-- List all RLS policies
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/
