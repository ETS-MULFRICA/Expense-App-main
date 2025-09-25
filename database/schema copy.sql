-- ExpenseNavigator Database Schema for Supabase
-- Run this SQL in your Supabase SQL editor

-- Enable Row Level Security (RLS) for all tables
-- This ensures users can only access their own data

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  currency TEXT DEFAULT 'XAF',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Users can update their own profile  
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense categories" ON expense_categories
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Expense Subcategories table
CREATE TABLE IF NOT EXISTS expense_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE expense_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense subcategories" ON expense_subcategories
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Income Categories table
CREATE TABLE IF NOT EXISTS income_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own income categories" ON income_categories
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Income Subcategories table
CREATE TABLE IF NOT EXISTS income_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE income_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own income subcategories" ON income_subcategories
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  merchant TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses" ON expenses
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Incomes table
CREATE TABLE IF NOT EXISTS incomes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  subcategory_id INTEGER REFERENCES income_subcategories(id),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own incomes" ON incomes
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own budgets" ON budgets
  FOR ALL USING (auth.uid()::text = user_id::text);

-- Budget Allocations table
CREATE TABLE IF NOT EXISTS budget_allocations (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  amount DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;

-- Users can manage allocations for their own budgets
CREATE POLICY "Users can manage own budget allocations" ON budget_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM budgets 
      WHERE budgets.id = budget_allocations.budget_id 
      AND budgets.user_id::text = auth.uid()::text
    )
  );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- Insert default demo user (optional)
-- Password is 'password' hashed with bcrypt
-- INSERT INTO users (username, password, name, email, role) VALUES 
-- ('demo', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', 'demo@example.com', 'user');

-- Note: You'll need to create the demo user through your app's registration flow
-- or modify the hash above to match your password hashing method
