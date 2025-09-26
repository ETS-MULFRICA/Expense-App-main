-- Migration: Ensure system income categories exist
-- This will insert 'Wages', 'Deals', and 'Other' as system categories if not present

INSERT INTO income_categories (id, name)
SELECT 1, 'Wages'
WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE id = 1);

INSERT INTO income_categories (id, name)
SELECT 2, 'Other'
WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE id = 2);

INSERT INTO income_categories (id, name)
SELECT 3, 'Deals'
WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE id = 3);
