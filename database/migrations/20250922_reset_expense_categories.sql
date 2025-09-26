-- Migration: Reset and seed expense_categories with specified categories
-- WARNING: This will delete all existing expense categories and reset IDs

BEGIN;

-- Remove all existing categories and reset sequence
DELETE FROM expense_categories;
-- Reset the serial sequence (PostgreSQL syntax)
ALTER SEQUENCE expense_categories_id_seq RESTART WITH 1;

-- Insert new categories in the specified order
INSERT INTO expense_categories (id, user_id, name, description, is_system)
VALUES
  (1, 0, 'Children', NULL, true),
  (2, 0, 'Debt', NULL, true),
  (3, 0, 'Education', NULL, true),
  (4, 0, 'Entertainment', NULL, true),
  (5, 0, 'Everyday', NULL, true),
  (6, 0, 'Gifts', NULL, true),
  (7, 0, 'Health/medical', NULL, true),
  (8, 0, 'Home', NULL, true),
  (9, 0, 'Insurance', NULL, true),
  (10, 0, 'Pets', NULL, true),
  (11, 0, 'Technology', NULL, true),
  (12, 0, 'Transportation', NULL, true),
  (13, 0, 'Travel', NULL, true),
  (14, 0, 'Utilities', NULL, true);

COMMIT;
