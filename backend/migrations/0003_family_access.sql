CREATE TABLE IF NOT EXISTS family_access (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 created_at TEXT NOT NULL
);
