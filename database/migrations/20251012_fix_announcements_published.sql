-- Ensure 'published' column exists on announcements
ALTER TABLE IF EXISTS announcements
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
