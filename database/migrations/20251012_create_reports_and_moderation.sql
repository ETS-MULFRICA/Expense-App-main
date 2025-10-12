-- Moderation & Reports schema additions
-- Compatibility: avoid BEGIN/COMMIT wrappers (runner handles transaction)

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
-- Seed moderation.manage permission in a schema-aware way
-- Handle schemas with optional resource/action columns
INSERT INTO permissions (name, description, resource, action)
SELECT 'moderation.manage', 'Manage reports and hidden content', 'moderation', 'manage'
WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='resource')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='action')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, resource)
SELECT 'moderation.manage', 'Manage reports and hidden content', 'moderation'
WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='resource')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='action')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description)
SELECT 'moderation.manage', 'Manage reports and hidden content'
WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='resource')
ON CONFLICT (name) DO NOTHING;

-- Link to admin role if possible
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name = 'moderation.manage'
ON CONFLICT DO NOTHING;
