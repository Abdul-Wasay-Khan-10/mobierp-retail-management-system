-- STEP 6: Add Initial Data
-- Run after step 5

-- Add categories
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

-- Add test users (plain text passwords for testing)
INSERT INTO users (username, password_hash, name, role, is_active) VALUES
  ('hamza', 'hamza123', 'Hamza (Admin)', 'OWNER', true),
  ('staff', 'staff123', 'Store Staff', 'STAFF', true)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role;

-- Verify setup
SELECT 'Categories created: ' || COUNT(*)::TEXT FROM categories;
SELECT 'Users created: ' || COUNT(*)::TEXT FROM users;
