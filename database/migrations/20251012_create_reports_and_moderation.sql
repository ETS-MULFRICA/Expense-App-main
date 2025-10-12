-- Moderation & Reports schema additions
BEGIN;

-- Add hidden flags to expenses and incomes
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS incomes ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Reports table tracks user-submitted flags on content
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('expense','income','budget')),
  target_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed','escalated')),
  resolution_note TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Seed moderation.manage permission and attach to admin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permissions') THEN
    INSERT INTO permissions(name, description)
    VALUES ('moderation.manage', 'Manage reports and hidden content')
    ON CONFLICT (name) DO NOTHING;

    -- Link to admin role if role_permissions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') AND 
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
      INSERT INTO role_permissions(role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'admin' AND p.name = 'moderation.manage'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

COMMIT;
