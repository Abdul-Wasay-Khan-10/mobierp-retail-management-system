-- ============================================================
-- MobiERP - Inventory Display Order (FIFO/LIFO)
-- Controls how products are sorted in inventory listing
-- FIFO = Oldest products first
-- LIFO = Newest products first
-- Run this after production-schema.sql
-- ============================================================

-- Create settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations" ON system_settings;
CREATE POLICY "Enable all operations" ON system_settings FOR ALL USING (true);

-- Insert default inventory display order setting
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES (
  'inventory_display_order', 
  'LIFO', 
  'Product sort order in inventory: FIFO (oldest first) or LIFO (newest first)'
)
ON CONFLICT (setting_key) DO UPDATE
SET description = EXCLUDED.description;

-- Verification
SELECT 
  'Inventory Display Order Setting' as info,
  setting_value as current_order,
  description
FROM system_settings
WHERE setting_key = 'inventory_display_order';

-- ============================================================
-- DONE! Use Settings page to toggle between FIFO and LIFO
-- This only affects the sort order in inventory listing
-- ============================================================
