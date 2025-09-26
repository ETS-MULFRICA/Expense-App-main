-- Migration: Add category_name column to incomes table
ALTER TABLE incomes ADD COLUMN category_name VARCHAR(255);