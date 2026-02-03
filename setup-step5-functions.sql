-- STEP 5: Create Functions and Triggers
-- Run after step 4

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers for updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at 
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate SKU
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

-- Function to check and reduce stock
CREATE OR REPLACE FUNCTION check_and_reduce_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_stock INTEGER;
BEGIN
  SELECT stock INTO v_product_stock
  FROM products
  WHERE id = NEW.product_id;
  
  IF v_product_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically reduce stock on sale
DROP TRIGGER IF EXISTS reduce_stock_on_sale ON sale_items;
CREATE TRIGGER reduce_stock_on_sale
  BEFORE INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION check_and_reduce_stock();
