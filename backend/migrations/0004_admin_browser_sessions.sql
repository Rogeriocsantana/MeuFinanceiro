-- Ephemeral handoff tickets and browser sessions; no financial records change.
CREATE TABLE IF NOT EXISTS admin_browser_sessions (
 token_hash TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('ticket','session')),
 user_id TEXT NOT NULL,
 credential_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_browser_sessions_expiry ON admin_browser_sessions(expires_at);
