-- System settings table to store app-wide configuration
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  site_name TEXT DEFAULT 'ExpenseTrack',
  logo_data_url TEXT,
  default_currency TEXT DEFAULT 'XAF',
  language TEXT DEFAULT 'en',
  email_from TEXT,
  email_templates JSONB, -- e.g., {"welcome": {"subject":"...","body":"..."}}
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure there is exactly one row (id=1) using upsert-like logic
INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
