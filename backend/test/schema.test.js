import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
test('D1 permite IDs iguais por usuário e impede repetição da operação', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_sync_foundation.sql',import.meta.url),'utf8'));
  const insert = db.prepare('INSERT INTO sync_records VALUES (?,?,?,?,?,?,?)');
  insert.run('a','entries','t',1,'{}',null,'now');
  insert.run('b','entries','t',1,'{}',null,'now');
  assert.equal(db.prepare('SELECT count(*) n FROM sync_records WHERE user_id=?').get('a').n,1);
  const change = db.prepare('INSERT INTO sync_changes(user_id,operation_id,entity_type,entity_id,version) VALUES (?,?,?,?,?)');
  change.run('a','op','entries','t',1);
  assert.throws(() => change.run('a','op','entries','t',1));
  change.run('b','op','entries','t',1);
  db.close();
});
