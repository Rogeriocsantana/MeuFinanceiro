import {Platform} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { SCHEMA } from './schema';
export type Entry = { id: string; description: string; amount_cents: number; purchase_date: string; category_id: string | null; person_id: string | null; version: number };
let pending: Promise<SQLite.SQLiteDatabase> | undefined;
export function database() {
  return pending ??= (async () => {
    // Development validation uses a separate file; production always uses financeiro.db.
    const isolated=typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION==='1';
    const previsual=typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_PREVISUAL_VALIDATION==='1';
    const refinement=typeof __DEV__!=='undefined'&&__DEV__&&process.env.EXPO_PUBLIC_VISUAL_REFINEMENT_REVIEW==='1';
    const db = await SQLite.openDatabaseAsync(refinement?'financeiro-visual-refinement-review.db':previsual?'financeiro-previsual-validation.db':isolated?'financeiro-validacao-20261020.db':'financeiro.db');
    const version = await db.getFirstAsync<{user_version:number}>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 2) throw new Error('Banco criado por versão mais recente do aplicativo.');
    await db.execAsync(SCHEMA);
    return db;
  })();
}
export async function listEntries() {
  return (await database()).getAllAsync<Entry>('SELECT * FROM entries WHERE deleted_at IS NULL ORDER BY purchase_date DESC, updated_at DESC LIMIT 100');
}
export async function backupState() {
  const rows = await (await database()).getAllAsync<{key:string;value:number}>('SELECT * FROM local_meta');
  return Object.fromEntries(rows.map(r => [r.key,r.value]));
}
export async function addEntry(description: string, cents: number) {
  if (!description.trim() || !Number.isSafeInteger(cents) || !cents) throw new Error('Informe uma descrição e um valor válido.');
  const db = await database(), id = Crypto.randomUUID(), now = new Date().toISOString();
  const local = new Date();
  const day = `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`;
  const payload = { id, description: description.trim(), amount_cents: cents, purchase_date: day };
  const write=async(tx:any)=>{
    await tx.runAsync('INSERT INTO entries(id,description,amount_cents,purchase_date,updated_at) VALUES (?,?,?,?,?)',id,payload.description,cents,day,now);
    await tx.runAsync('INSERT INTO outbox VALUES (?,?,?,?,?,?)',Crypto.randomUUID(),'entries',id,0,JSON.stringify(payload),now);
    await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");
  };
  if(Platform.OS==='web')await db.withTransactionAsync(()=>write(db));else await db.withExclusiveTransactionAsync(write);
}
// A cópia usa a API de backup do SQLite; inclui páginas ainda presentes no WAL.
export async function snapshot() {
  const copy = await SQLite.openDatabaseAsync(':memory:');
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: await database(), destDatabase: copy });
    const row = await copy.getFirstAsync<{value:number}>("SELECT value FROM local_meta WHERE key='revision'");
    return { bytes: await copy.serializeAsync(), revision: row?.value ?? 0 };
  } finally { await copy.closeAsync(); }
}
export async function markBackedUp(revision: number) {
  await (await database()).runAsync("UPDATE local_meta SET value=MAX(value,?) WHERE key='backed_up_revision'",revision);
}
