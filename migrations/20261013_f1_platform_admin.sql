BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
CREATE TABLE IF NOT EXISTS platform_admin_roles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','support')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_one_owner ON platform_admin_roles(role) WHERE role='owner';
CREATE INDEX IF NOT EXISTS idx_users_suspended_at ON users(suspended_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit ON audit_log(occurred_at DESC);
INSERT INTO schema_migrations(version) VALUES('20261013_f1_platform_admin') ON CONFLICT DO NOTHING;
COMMIT;
