-- Reset and seed default income categories with fixed IDs
-- WARNING: This will delete all existing income categories!

BEGIN;

-- Remove all existing categories
DELETE FROM income_categories;

-- Reset the sequence (if using serial/auto-increment)
-- Adjust sequence name if needed
ALTER SEQUENCE income_categories_id_seq RESTART WITH 1;

-- Insert default categories with fixed IDs
INSERT INTO income_categories (id, name) VALUES
  (1, 'Wages'),
  (2, 'Other'),
  (3, 'Deals');

COMMIT;
