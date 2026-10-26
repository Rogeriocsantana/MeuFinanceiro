-- Immutable snapshots make a cursor safe even if the same entity changes again.
ALTER TABLE sync_changes ADD COLUMN payload TEXT;
ALTER TABLE sync_changes ADD COLUMN deleted_at TEXT;
ALTER TABLE sync_changes ADD COLUMN updated_at TEXT;
ALTER TABLE sync_changes ADD COLUMN fingerprint TEXT;
UPDATE sync_changes SET payload=(SELECT payload FROM sync_records r WHERE r.user_id=sync_changes.user_id AND r.entity_type=sync_changes.entity_type AND r.entity_id=sync_changes.entity_id), updated_at=(SELECT updated_at FROM sync_records r WHERE r.user_id=sync_changes.user_id AND r.entity_type=sync_changes.entity_type AND r.entity_id=sync_changes.entity_id);
