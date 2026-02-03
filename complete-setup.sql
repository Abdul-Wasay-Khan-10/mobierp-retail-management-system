-- ============================================================
-- MobiERP - Complete Database Setup for Supabase
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP EXISTING TABLES (if any)
-- ============================================================
DROP TABLE IF EXISTS inventory_units CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS sku_counters CASCADE;

-- ============================================================
-- CREATE TABLES
-- ============================================================

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(200) NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  track_individually BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number VARCHAR(50) NOT NULL UNIQUE,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  cost_price DECIMAL(10, 2) NOT NULL CHECK (cost_price >= 0),
  subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Units (for IMEI tracking)
CREATE TABLE inventory_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number VARCHAR(100) NOT NULL UNIQUE,
  imei VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'SOLD', 'RETURNED', 'DEFECTIVE')),
  sale_item_id UUID REFERENCES sale_items(id) ON DELETE SET NULL,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SKU Counters
CREATE TABLE sku_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key VARCHAR(20) NOT NULL UNIQUE,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CREATE INDEXES
-- ============================================================
CREATE INDEX idx_categories_name ON categories(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sales_seller ON sales(seller_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_number ON sales(sale_number);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_sale_items_created_at ON sale_items(created_at);
CREATE INDEX idx_inventory_units_product ON inventory_units(product_id);
CREATE INDEX idx_inventory_units_status ON inventory_units(status);
CREATE INDEX idx_sku_counters_date ON sku_counters(date_key);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_counters ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CREATE RLS POLICIES (Allow all for now)
-- ============================================================
CREATE POLICY "Enable all operations" ON categories FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON products FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON users FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON sales FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON sale_items FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON inventory_units FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON sku_counters FOR ALL USING (true);

-- ============================================================
-- CREATE FUNCTIONS
-- ============================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SKU Generation Function (Format: CAT-BRAND-DDMMYYYY-XXXX)
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
  v_date_key := TO_CHAR(CURRENT_DATE, 'DDMMYYYY');
  
  INSERT INTO sku_counters (date_key, counter)
  VALUES (v_date_key, 1)
  ON CONFLICT (date_key) 
  DO UPDATE SET counter = sku_counters.counter + 1
  RETURNING counter INTO v_counter;
  
  v_cat_code := UPPER(SUBSTRING(REGEXP_REPLACE(p_category_name, '[^a-zA-Z]', '', 'g'), 1, 3));
  v_brand_code := UPPER(SUBSTRING(REGEXP_REPLACE(p_brand, '[^a-zA-Z]', '', 'g'), 1, 4));
  v_sku := v_cat_code || '-' || v_brand_code || '-' || v_date_key || '-' || LPAD(v_counter::TEXT, 4, '0');
  
  RETURN v_sku;
END;
$$ LANGUAGE plpgsql;

-- Stock Reduction Function
CREATE OR REPLACE FUNCTION check_and_reduce_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_stock INTEGER;
BEGIN
  SELECT stock INTO v_product_stock FROM products WHERE id = NEW.product_id;
  
  IF v_product_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product ID: %', NEW.product_id;
  END IF;
  
  UPDATE products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CREATE TRIGGERS
-- ============================================================

-- Updated_at triggers
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stock reduction trigger
CREATE TRIGGER reduce_stock_on_sale
  BEFORE INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION check_and_reduce_stock();

-- ============================================================
-- INSERT INITIAL DATA
-- ============================================================

-- Insert Categories
INSERT INTO categories (name) VALUES
  ('Smartphones'),
  ('Keypad Phones'),
  ('Tablets'),
  ('Watches'),
  ('Wearables'),
  ('Pouches'),
  ('Chargers'),
  ('Audio'),
  ('Accessories');

-- Insert Test Users (plain text passwords for development)
-- Username: hamza, Password: hamza123 (Owner)
-- Username: staff, Password: staff123 (Staff)
INSERT INTO users (username, password_hash, name, role, is_active) VALUES
  ('hamza', 'hamza123', 'Hamza (Admin)', 'OWNER', true),
  ('staff', 'staff123', 'Store Staff', 'STAFF', true);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Setup Complete!' AS status,
       (SELECT COUNT(*) FROM categories) AS categories_count,
       (SELECT COUNT(*) FROM users) AS users_count;
