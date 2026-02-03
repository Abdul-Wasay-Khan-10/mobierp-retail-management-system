-- Add test users for development
-- WARNING: These use plain text passwords for testing only
-- In production, use proper bcrypt hashes

-- Delete existing test users first (optional)
DELETE FROM users WHERE username IN ('hamza', 'staff');

-- Add test users with plain text passwords
-- Password for hamza: hamza123
-- Password for staff: staff123
INSERT INTO users (username, password_hash, name, role, is_active) VALUES
  ('hamza', 'hamza123', 'Hamza (Admin)', 'OWNER', true),
  ('staff', 'staff123', 'Store Staff', 'STAFF', true)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- View created users
SELECT id, username, name, role, is_active, created_at FROM users;
