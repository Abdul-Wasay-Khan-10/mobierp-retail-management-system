-- ============================================================
-- MobiERP - Insert 100 Dummy Products
-- Products dated from Feb 1, 2026 to Feb 7, 2027
-- Run after production-schema.sql
-- ============================================================

-- Temporary function to generate random dates between two dates
CREATE OR REPLACE FUNCTION random_date(start_date DATE, end_date DATE)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN start_date + (random() * (end_date - start_date))::INTEGER * INTERVAL '1 day' +
         (random() * 86400)::INTEGER * INTERVAL '1 second';
END;
$$ LANGUAGE plpgsql;

-- Insert 100 products with varied data
DO $$
DECLARE
  v_category_ids UUID[];
  v_brands TEXT[] := ARRAY['Samsung', 'Apple', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'OnePlus', 'Nokia', 'Infinix', 'Tecno', 'Itel', 'Huawei', 'Honor', 'Motorola', 'Sony'];
  v_smartphone_models TEXT[] := ARRAY['Galaxy S23', 'iPhone 14', 'Redmi Note 12', 'A78', 'Y27', 'C55', '11R', 'G42', 'Note 30', 'Spark 10', 'A60', 'Nova 11', 'X9', 'Edge 40', 'Xperia 10'];
  v_keypad_models TEXT[] := ARRAY['210', '105', '150', '216', '225', '3310', '106', '108', '110', '130'];
  v_tablet_models TEXT[] := ARRAY['Tab A8', 'iPad 10th', 'Pad 6', 'Pad Air', 'MatePad', 'Tab M10', 'Tab P11'];
  v_watch_models TEXT[] := ARRAY['Watch 6', 'Watch SE', 'Watch S1', 'Band 8', 'Fit 3', 'Watch GT 4'];
  v_accessory_types TEXT[] := ARRAY['Case', 'Screen Protector', 'Charger', 'Cable', 'Earbuds', 'Power Bank', 'Holder', 'Stand'];
  
  v_category_id UUID;
  v_category_name TEXT;
  v_brand TEXT;
  v_model TEXT;
  v_cost DECIMAL(10,2);
  v_stock INTEGER;
  v_sku TEXT;
  v_created_at TIMESTAMPTZ;
  i INTEGER;
BEGIN
  -- Get all category IDs
  SELECT ARRAY_AGG(id ORDER BY name) INTO v_category_ids FROM categories;
  
  -- Insert 100 products
  FOR i IN 1..100 LOOP
    -- Random category
    v_category_id := v_category_ids[1 + floor(random() * array_length(v_category_ids, 1))::INTEGER];
    SELECT name INTO v_category_name FROM categories WHERE id = v_category_id;
    
    -- Random brand
    v_brand := v_brands[1 + floor(random() * array_length(v_brands, 1))::INTEGER];
    
    -- Model based on category
    CASE v_category_name
      WHEN 'Smartphones' THEN
        v_model := v_smartphone_models[1 + floor(random() * array_length(v_smartphone_models, 1))::INTEGER] || ' ' || (2022 + floor(random() * 5))::TEXT;
        v_cost := 15000 + (random() * 185000)::DECIMAL(10,2);
        v_stock := 5 + floor(random() * 50)::INTEGER;
      WHEN 'Keypad Phones' THEN
        v_model := v_keypad_models[1 + floor(random() * array_length(v_keypad_models, 1))::INTEGER];
        v_cost := 800 + (random() * 4200)::DECIMAL(10,2);
        v_stock := 10 + floor(random() * 100)::INTEGER;
      WHEN 'Tablets' THEN
        v_model := v_tablet_models[1 + floor(random() * array_length(v_tablet_models, 1))::INTEGER] || ' ' || (32 * (1 + floor(random() * 4)))::TEXT || 'GB';
        v_cost := 20000 + (random() * 130000)::DECIMAL(10,2);
        v_stock := 3 + floor(random() * 20)::INTEGER;
      WHEN 'Watches' THEN
        v_model := v_watch_models[1 + floor(random() * array_length(v_watch_models, 1))::INTEGER];
        v_cost := 2000 + (random() * 48000)::DECIMAL(10,2);
        v_stock := 5 + floor(random() * 30)::INTEGER;
      WHEN 'Wearables' THEN
        v_model := 'Band ' || (1 + floor(random() * 9))::TEXT || ' Pro';
        v_cost := 1500 + (random() * 8500)::DECIMAL(10,2);
        v_stock := 10 + floor(random() * 50)::INTEGER;
      WHEN 'Pouches' THEN
        v_model := 'Leather Pouch ' || (ARRAY['Classic', 'Premium', 'Sport', 'Slim', 'Wallet'])[1 + floor(random() * 5)::INTEGER];
        v_cost := 300 + (random() * 2700)::DECIMAL(10,2);
        v_stock := 20 + floor(random() * 80)::INTEGER;
      WHEN 'Chargers' THEN
        v_model := (ARRAY['Fast Charger', 'Wall Adapter', 'Car Charger', 'Wireless Pad'])[1 + floor(random() * 4)::INTEGER] || ' ' || (15 + 5 * floor(random() * 6))::TEXT || 'W';
        v_cost := 500 + (random() * 4500)::DECIMAL(10,2);
        v_stock := 30 + floor(random() * 100)::INTEGER;
      WHEN 'Audio' THEN
        v_model := (ARRAY['Earbuds', 'Headphones', 'Speaker', 'Soundbar'])[1 + floor(random() * 4)::INTEGER] || ' ' || (ARRAY['Pro', 'Max', 'Elite', 'Ultra', 'Plus'])[1 + floor(random() * 5)::INTEGER];
        v_cost := 1000 + (random() * 29000)::DECIMAL(10,2);
        v_stock := 8 + floor(random() * 40)::INTEGER;
      WHEN 'Accessories' THEN
        v_model := v_accessory_types[1 + floor(random() * array_length(v_accessory_types, 1))::INTEGER] || ' ' || (ARRAY['Basic', 'Premium', 'Pro', 'Ultra'])[1 + floor(random() * 4)::INTEGER];
        v_cost := 200 + (random() * 4800)::DECIMAL(10,2);
        v_stock := 25 + floor(random() * 100)::INTEGER;
      ELSE
        v_model := 'Generic Product ' || i::TEXT;
        v_cost := 1000 + (random() * 9000)::DECIMAL(10,2);
        v_stock := 10 + floor(random() * 50)::INTEGER;
    END CASE;
    
    -- Generate SKU using the function
    v_sku := generate_sku(v_category_name, v_brand);
    
    -- Random date between Feb 1, 2026 and Feb 7, 2027
    v_created_at := random_date('2026-02-01'::DATE, '2027-02-07'::DATE);
    
    -- Insert product
    INSERT INTO products (
      category_id,
      brand,
      model,
      sku,
      cost,
      stock,
      track_individually,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      v_category_id,
      v_brand,
      v_model,
      v_sku,
      ROUND(v_cost, 2),
      v_stock,
      CASE WHEN v_category_name IN ('Smartphones', 'Tablets', 'Watches') THEN (random() > 0.7) ELSE false END,
      true,
      v_created_at,
      v_created_at
    );
    
    -- Progress indicator every 20 products
    IF i % 20 = 0 THEN
      RAISE NOTICE 'Inserted % products...', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Successfully inserted 100 products!';
END $$;

-- Drop temporary function
DROP FUNCTION random_date(DATE, DATE);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Show summary
SELECT 
  c.name as category,
  COUNT(p.id) as product_count,
  MIN(p.stock) as min_stock,
  MAX(p.stock) as max_stock,
  AVG(p.stock)::INTEGER as avg_stock,
  MIN(p.cost)::INTEGER as min_cost,
  MAX(p.cost)::INTEGER as max_cost,
  AVG(p.cost)::INTEGER as avg_cost
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
GROUP BY c.id, c.name
ORDER BY c.name;

-- Show date range
SELECT 
  'Products Date Range' as info,
  MIN(created_at)::DATE as earliest_product,
  MAX(created_at)::DATE as latest_product,
  COUNT(*) as total_products
FROM products
WHERE is_active = true;

-- Show total inventory value
SELECT 
  'Inventory Summary' as info,
  COUNT(*) as total_products,
  SUM(stock) as total_units,
  'Rs ' || TO_CHAR(SUM(stock * cost), 'FM999,999,999') as total_inventory_value
FROM products
WHERE is_active = true;

-- Show some sample products
SELECT 
  c.name as category,
  p.brand,
  p.model,
  p.sku,
  p.stock,
  'Rs ' || p.cost::TEXT as cost,
  p.created_at::DATE as added_on
FROM products p
JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true
ORDER BY p.created_at
LIMIT 10;

-- ============================================================
-- DONE! 100 products inserted with varied stock levels
-- ============================================================
