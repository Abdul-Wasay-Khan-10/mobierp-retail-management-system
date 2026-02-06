-- ============================================================
-- Quick Fix for User Session Issues
-- Run this if you get "foreign key constraint sales_seller_id_fkey" error
-- ============================================================

-- 1. Check existing users
SELECT 
  id,
  username,
  name,
  role,
  is_active,
  created_at
FROM users
ORDER BY created_at;

-- 2. Verify test users exist (should show 2 users)
SELECT COUNT(*) as user_count FROM users WHERE username IN ('hamza', 'staff');

-- 3. If users don't exist, insert them:
INSERT INTO users (username, password_hash, name, role, is_active) VALUES
  ('hamza', 'hamza123', 'Hamza (Admin)', 'OWNER', true),
  ('staff', 'staff123', 'Store Staff', 'STAFF', true)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 4. Verify again
SELECT 
  id as user_id,
  username,
  name,
  role
FROM users;

-- ============================================================
-- AFTER RUNNING THIS:
-- 1. Go to your application
-- 2. Click LOGOUT (important!)
-- 3. Login again with: hamza / hamza123
-- This will refresh your session with the correct user ID from database
-- ============================================================
