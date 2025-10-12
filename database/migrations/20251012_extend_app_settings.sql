-- Extend app_settings with additional configuration fields
ALTER TABLE IF EXISTS app_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS date_format TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS theme_mode TEXT, -- 'light' | 'dark' | 'system'
  ADD COLUMN IF NOT EXISTS favicon_data_url TEXT,
  ADD COLUMN IF NOT EXISTS features JSONB,
  ADD COLUMN IF NOT EXISTS security JSONB;

-- Seed defaults where missing for the singleton row id=1
UPDATE app_settings
SET
  timezone = COALESCE(timezone, 'UTC'),
  date_format = COALESCE(date_format, 'yyyy-MM-dd'),
  primary_color = COALESCE(primary_color, '#0ea5e9'), -- sky-500
  theme_mode = COALESCE(theme_mode, 'system'),
  features = COALESCE(features, '{"allowRegistration": true, "announcements": true, "moderation": true, "backups": true, "reports": true}'::jsonb),
  security = COALESCE(security, '{"require2FA": false, "passwordMinLength": 8}'::jsonb),
  updated_at = NOW()
WHERE id = 1;
