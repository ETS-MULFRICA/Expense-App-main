-- Extend announcements with extra fields for UI/analytics
ALTER TABLE IF EXISTS announcements
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal', -- 'normal' | 'urgent'
  ADD COLUMN IF NOT EXISTS label TEXT, -- e.g., 'welcome', 'maintenance'
  ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'all';

-- Backfill defaults
UPDATE announcements
SET priority = COALESCE(priority, 'normal'),
    audience = COALESCE(audience, 'all')
WHERE TRUE;
