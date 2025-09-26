-- Migration: Make category_id nullable in incomes table
ALTER TABLE incomes ALTER COLUMN category_id DROP NOT NULL;
