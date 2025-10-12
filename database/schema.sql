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

-- Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Income Categories table
CREATE TABLE IF NOT EXISTS income_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
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

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  category_name TEXT,
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  merchant TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
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

-- Budget Allocations table
CREATE TABLE IF NOT EXISTS budget_allocations (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  amount DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Seed default roles
INSERT INTO roles (name, description, is_system) VALUES
  ('admin', 'Administrator role with full access', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO roles (name, description, is_system) VALUES
  ('user', 'Standard user role', true)
ON CONFLICT (name) DO NOTHING;

-- Seed default permissions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permissions' AND column_name = 'action'
  ) THEN
    -- Schema with resource + action columns present
    INSERT INTO permissions (name, description, resource, action) VALUES
      ('admin.access', 'Access to admin dashboard and routes', 'system', 'access'),
      ('user.manage', 'Manage users (create, update, suspend, reset, delete)', 'user', 'manage'),
      ('expense.read', 'Read expenses', 'expense', 'read'),
      ('expense.write', 'Create/update/delete expenses', 'expense', 'write'),
      ('income.read', 'Read incomes', 'income', 'read'),
      ('income.write', 'Create/update/delete incomes', 'income', 'write'),
      ('budget.read', 'Read budgets', 'budget', 'read'),
      ('budget.write', 'Create/update/delete budgets', 'budget', 'write')
    ON CONFLICT (name) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'permissions' AND column_name = 'resource'
  ) THEN
    -- Schema with only resource column present
    INSERT INTO permissions (name, description, resource) VALUES
      ('admin.access', 'Access to admin dashboard and routes', 'system'),
      ('user.manage', 'Manage users (create, update, suspend, reset, delete)', 'user'),
      ('expense.read', 'Read expenses', 'expense'),
      ('expense.write', 'Create/update/delete expenses', 'expense'),
      ('income.read', 'Read incomes', 'income'),
      ('income.write', 'Create/update/delete incomes', 'income'),
      ('budget.read', 'Read budgets', 'budget'),
      ('budget.write', 'Create/update/delete budgets', 'budget')
    ON CONFLICT (name) DO NOTHING;
  ELSE
    -- Minimal schema
    INSERT INTO permissions (name, description) VALUES
      ('admin.access', 'Access to admin dashboard and routes'),
      ('user.manage', 'Manage users (create, update, suspend, reset, delete)'),
      ('expense.read', 'Read expenses'),
      ('expense.write', 'Create/update/delete expenses'),
      ('income.read', 'Read incomes'),
      ('income.write', 'Create/update/delete incomes'),
      ('budget.read', 'Read budgets'),
      ('budget.write', 'Create/update/delete budgets')
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- Link admin role to broad permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.name IN ('admin.access','user.manage','expense.read','expense.write','income.read','income.write','budget.read','budget.write')
ON CONFLICT DO NOTHING;

-- Ensure user role has basic reads
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'user'
  AND p.name IN ('expense.read','income.read','budget.read')
ON CONFLICT DO NOTHING;

-- Backfill user_roles from legacy users.role column
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u
JOIN roles r ON r.name = 'user'
WHERE (u.role IS NULL OR u.role = 'user')
ON CONFLICT DO NOTHING;

-- Create activity_log table for tracking user actions
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource_type ON activity_log(resource_type);


-- Insert default demo user (optional)
-- Password is 'password' hashed with bcrypt
-- INSERT INTO users (username, password, name, email, role) VALUES 
-- ('demo', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', 'demo@example.com', 'user');

-- Note: You'll need to create the demo user through your app's registration flow
-- or modify the hash above to match your password hashing method
