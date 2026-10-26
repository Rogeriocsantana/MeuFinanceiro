-- Base futura de sincronização. Nenhuma API de escrita está habilitada ainda.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sync_records (
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version > 0),
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  deleted_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS sync_changes (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  UNIQUE(user_id, operation_id)
);
CREATE INDEX IF NOT EXISTS sync_changes_user_cursor ON sync_changes(user_id, sequence);
