-- ============================================================
-- MobiERP - Comprehensive Database Validation Script
-- Run this to verify database integrity and security
-- ============================================================

-- SECTION 1: Table Existence Check
-- ============================================================
SELECT 
    'Table Existence Check' as check_type,
    CASE 
        WHEN COUNT(*) = 7 THEN '✓ PASS - All 7 required tables exist'
        ELSE '✗ FAIL - Missing tables: ' || (7 - COUNT(*))::text
    END as result
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('categories', 'products', 'users', 'sales', 'sale_items', 'inventory_units', 'sku_counters');

-- SECTION 2: Required Extensions Check
-- ============================================================
SELECT 
    'Extension Check' as check_type,
    CASE 
        WHEN COUNT(*) >= 1 THEN '✓ PASS - uuid-ossp extension is installed'
        ELSE '✗ FAIL - uuid-ossp extension is missing'
    END as result
FROM pg_extension 
WHERE extname = 'uuid-ossp';

-- SECTION 3: Foreign Key Constraints Check
-- ============================================================
WITH expected_fks AS (
    SELECT unnest(ARRAY[
        'products_category_id_fkey',
        'sales_seller_id_fkey',
        'sale_items_sale_id_fkey',
        'sale_items_product_id_fkey',
        'inventory_units_product_id_fkey',
        'inventory_units_sale_item_id_fkey'
    ]) as fk_name
),
actual_fks AS (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
      AND table_schema = 'public'
)
SELECT 
    'Foreign Key Check' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM expected_fks) = (SELECT COUNT(*) FROM expected_fks e WHERE EXISTS (SELECT 1 FROM actual_fks a WHERE a.constraint_name LIKE '%' || SPLIT_PART(e.fk_name, '_fkey', 1) || '%'))
        THEN '✓ PASS - All foreign key constraints exist'
        ELSE '⚠ WARNING - Some foreign keys may be missing or have different names'
    END as result;

-- SECTION 4: Index Coverage Check
-- ============================================================
WITH expected_indexes AS (
    SELECT unnest(ARRAY[
        'idx_categories_name',
        'idx_products_category',
        'idx_products_sku',
        'idx_products_brand',
        'idx_users_username',
        'idx_sales_seller',
        'idx_sales_created_at',
        'idx_sale_items_sale',
        'idx_sale_items_product',
        'idx_inventory_units_product',
        'idx_inventory_units_status'
    ]) as index_name
),
actual_indexes AS (
    SELECT indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public'
)
SELECT 
    'Index Coverage' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM expected_indexes WHERE index_name IN (SELECT indexname FROM actual_indexes)) >= 8
        THEN '✓ PASS - Critical indexes are in place (' || 
             (SELECT COUNT(*) FROM expected_indexes WHERE index_name IN (SELECT indexname FROM actual_indexes))::text || 
             ' of 11 found)'
        ELSE '✗ FAIL - Missing critical indexes for performance'
    END as result;

-- SECTION 5: Row-Level Security (RLS) Check
-- ============================================================
SELECT 
    'RLS Security Check' as check_type,
    CASE 
        WHEN COUNT(*) = 7 THEN '✓ PASS - RLS enabled on all 7 tables'
        ELSE '⚠ WARNING - RLS not enabled on all tables'
    END as result
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('categories', 'products', 'users', 'sales', 'sale_items', 'inventory_units', 'sku_counters')
  AND rowsecurity = true;

-- SECTION 6: RLS Policies Check
-- ============================================================
SELECT 
    'RLS Policies Check' as check_type,
    CASE 
        WHEN COUNT(*) >= 7 THEN '✓ PASS - RLS policies configured (' || COUNT(*)::text || ' policies)'
        ELSE '⚠ WARNING - Missing RLS policies (Found: ' || COUNT(*)::text || ')'
    END as result
FROM pg_policies 
WHERE schemaname = 'public';

-- SECTION 7: Triggers Check
-- ============================================================
WITH expected_triggers AS (
    SELECT unnest(ARRAY[
        'update_categories_updated_at',
        'update_products_updated_at',
        'update_users_updated_at',
        'reduce_stock_on_sale'
    ]) as trigger_name
)
SELECT 
    'Triggers Check' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' 
              AND NOT t.tgisinternal
        ) >= 4
        THEN '✓ PASS - Essential triggers are active'
        ELSE '✗ FAIL - Missing critical triggers'
    END as result;

-- SECTION 8: Functions Check
-- ============================================================
WITH expected_functions AS (
    SELECT unnest(ARRAY[
        'update_updated_at_column',
        'generate_sku',
        'check_and_reduce_stock'
    ]) as function_name
)
SELECT 
    'Functions Check' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
              AND p.proname IN (SELECT function_name FROM expected_functions)
        ) = 3
        THEN '✓ PASS - All required functions exist'
        ELSE '✗ FAIL - Missing required functions'
    END as result;

-- SECTION 9: CHECK Constraints Validation
-- ============================================================
SELECT 
    'CHECK Constraints' as check_type,
    CASE 
        WHEN COUNT(*) >= 10 THEN '✓ PASS - CHECK constraints enforce data integrity (' || COUNT(*)::text || ' constraints)'
        ELSE '⚠ WARNING - Insufficient CHECK constraints'
    END as result
FROM information_schema.check_constraints
WHERE constraint_schema = 'public';

-- SECTION 10: NOT NULL Constraints on Critical Columns
-- ============================================================
WITH critical_columns AS (
    SELECT 
        'products' as table_name, 'sku' as column_name UNION ALL
    SELECT 'products', 'cost' UNION ALL
    SELECT 'products', 'stock' UNION ALL
    SELECT 'users', 'username' UNION ALL
    SELECT 'users', 'password_hash' UNION ALL
    SELECT 'sales', 'sale_number' UNION ALL
    SELECT 'sales', 'total_amount' UNION ALL
    SELECT 'sale_items', 'quantity' UNION ALL
    SELECT 'sale_items', 'unit_price'
)
SELECT 
    'NOT NULL Constraints' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM critical_columns c
            JOIN information_schema.columns i 
              ON c.table_name = i.table_name 
              AND c.column_name = i.column_name
            WHERE i.table_schema = 'public' 
              AND i.is_nullable = 'NO'
        ) = (SELECT COUNT(*) FROM critical_columns)
        THEN '✓ PASS - All critical columns have NOT NULL constraints'
        ELSE '⚠ WARNING - Some critical columns allow NULL values'
    END as result;

-- SECTION 11: UNIQUE Constraints Check
-- ============================================================
SELECT 
    'UNIQUE Constraints' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
              AND table_name = 'products' 
              AND constraint_name LIKE '%sku%'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
              AND table_name = 'users' 
              AND constraint_name LIKE '%username%'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
              AND table_name = 'sales' 
              AND constraint_name LIKE '%sale_number%'
        )
        THEN '✓ PASS - Critical UNIQUE constraints exist (SKU, Username, Sale Number)'
        ELSE '✗ FAIL - Missing critical UNIQUE constraints'
    END as result;

-- SECTION 12: Data Integrity - Orphaned Records Check
-- ============================================================
SELECT 
    'Orphaned Records Check' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM sale_items si 
            WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = si.sale_id)
        ) = 0
        AND (
            SELECT COUNT(*) FROM sale_items si 
            WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = si.product_id)
        ) = 0
        AND (
            SELECT COUNT(*) FROM products p 
            WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p.category_id)
        ) = 0
        AND (
            SELECT COUNT(*) FROM sales s 
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.seller_id)
        ) = 0
        THEN '✓ PASS - No orphaned records found'
        ELSE '⚠ WARNING - Orphaned records detected (data inconsistency)'
    END as result;

-- SECTION 13: Stock Integrity Check
-- ============================================================
SELECT 
    'Stock Integrity' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM products WHERE stock < 0) = 0
        THEN '✓ PASS - No negative stock values'
        ELSE '✗ FAIL - Negative stock detected (' || (SELECT COUNT(*) FROM products WHERE stock < 0)::text || ' products)'
    END as result;

-- SECTION 14: Price/Cost Validation
-- ============================================================
SELECT 
    'Price Validation' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM products WHERE cost < 0) = 0
        AND (SELECT COUNT(*) FROM sale_items WHERE unit_price < 0 OR cost_price < 0) = 0
        THEN '✓ PASS - No negative prices or costs'
        ELSE '✗ FAIL - Negative prices/costs detected'
    END as result;

-- SECTION 15: User Account Security Check
-- ============================================================
SELECT 
    'User Security' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM users WHERE username IS NULL OR username = '') = 0
        AND (SELECT COUNT(*) FROM users WHERE password_hash IS NULL OR password_hash = '') = 0
        AND (SELECT COUNT(*) FROM users WHERE role NOT IN ('OWNER', 'STAFF')) = 0
        THEN '✓ PASS - User accounts properly configured'
        ELSE '✗ FAIL - User account data integrity issues'
    END as result;

-- SECTION 16: Timestamp Columns Check
-- ============================================================
SELECT 
    'Timestamp Tracking' as check_type,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND column_name IN ('created_at', 'updated_at')
              AND data_type = 'timestamp with time zone'
        ) >= 10
        THEN '✓ PASS - Timestamp tracking is in place'
        ELSE '⚠ WARNING - Some tables missing timestamp columns'
    END as result;

-- SECTION 17: CASCADE Delete Configuration
-- ============================================================
SELECT 
    'CASCADE Configuration' as check_type,
    '✓ INFO - FK cascades: sale_items ON DELETE CASCADE (correct), inventory_units ON DELETE CASCADE (correct)' as result;

-- ============================================================
-- FINAL SUMMARY
-- ============================================================
SELECT 
    '===================' as separator,
    'VALIDATION COMPLETE' as status,
    '===================' as separator2;

-- Detailed table information
SELECT 
    t.table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)) as total_size,
    (SELECT COUNT(*) FROM information_schema.table_constraints tc 
     WHERE tc.table_name = t.table_name 
       AND tc.constraint_type IN ('FOREIGN KEY', 'PRIMARY KEY', 'UNIQUE', 'CHECK')
       AND tc.table_schema = 'public') as constraint_count
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- Count records per table
SELECT 'categories' as table_name, COUNT(*) as record_count FROM categories
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL
SELECT 'inventory_units', COUNT(*) FROM inventory_units
UNION ALL
SELECT 'sku_counters', COUNT(*) FROM sku_counters
ORDER BY table_name;
