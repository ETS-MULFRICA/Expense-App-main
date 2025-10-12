-- Safe seeding: Insert system expense categories once (global),
-- using the first available user_id to satisfy NOT NULL.
-- This avoids duplicate-key errors when a unique constraint exists on system names.
WITH u AS (
  SELECT id AS user_id FROM users ORDER BY id LIMIT 1
), seed(name, descr) AS (
  VALUES
    ('Children', 'Children expenses'),
    ('Debt', 'Debt expenses'),
    ('Education', 'Education expenses'),
    ('Entertainment', 'Entertainment expenses'),
    ('Everyday', 'Everyday expenses'),
    ('Gifts', 'Gifts and donations'),
    ('Health/medical', 'Health/medical expenses'),
    ('Home', 'Home expenses'),
    ('Insurance', 'Insurance expenses'),
    ('Pets', 'Pets expenses'),
    ('Technology', 'Technology expenses'),
    ('Transportation', 'Transportation expenses'),
    ('Travel', 'Travel expenses'),
    ('Utilities', 'Utilities expenses')
)
INSERT INTO expense_categories (user_id, name, description, is_system)
SELECT u.user_id, s.name, s.descr, true
FROM seed s
JOIN u ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories ec WHERE ec.is_system = true AND ec.name = s.name
);
