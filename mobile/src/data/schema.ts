export const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS local_meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT OR IGNORE INTO local_meta VALUES ('revision',0),('backed_up_revision',0);
CREATE TABLE IF NOT EXISTS entries (
 id TEXT PRIMARY KEY, description TEXT NOT NULL, amount_cents INTEGER NOT NULL,
 purchase_date TEXT NOT NULL, invoice_month TEXT, category_id TEXT, person_id TEXT,
 source_id TEXT UNIQUE, source_payload TEXT, version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS entries_purchase_date ON entries(purchase_date);
CREATE INDEX IF NOT EXISTS entries_invoice_month ON entries(invoice_month);
-- As demais entidades preservam seus IDs e conteúdos até a migração dos modelos.
CREATE TABLE IF NOT EXISTS entity_records (
 entity_type TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted_at TEXT,
 PRIMARY KEY(entity_type,id)
);
CREATE TABLE IF NOT EXISTS outbox (
 operation_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 base_version INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
 created_at TEXT NOT NULL
);
PRAGMA user_version=2;
`;
