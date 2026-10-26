import {cloudPreferenceRows,materializeCloudPreference,CLOUD_PREFERENCES_TYPE} from './cloudPreferences';
import {utf8ToBytes} from '@noble/hashes/utils';
import {Platform} from 'react-native';
import * as Crypto from 'expo-crypto';
import {database} from './database';
import {locked} from './pluggyRepository';
import {SYNC_SCHEMA} from './pluggyModel';
export const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export const REMOTE_SCHEMA=`
CREATE TABLE IF NOT EXISTS remote_state(scope TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0,cursor INTEGER NOT NULL DEFAULT 0,last_success TEXT,error TEXT);
CREATE TABLE IF NOT EXISTS remote_shadow(scope TEXT,entity_type TEXT,entity_id TEXT,version INTEGER,payload TEXT,deleted_at TEXT,PRIMARY KEY(scope,entity_type,entity_id));
CREATE TABLE IF NOT EXISTS remote_queue(scope TEXT,operation_id TEXT PRIMARY KEY,entity_type TEXT,entity_id TEXT,base_version INTEGER,payload TEXT,deleted_at TEXT,UNIQUE(scope,entity_type,entity_id));
CREATE TABLE IF NOT EXISTS remote_tombstones(scope TEXT,entity_type TEXT,entity_id TEXT,payload TEXT,local_payload TEXT,deleted_at TEXT,PRIMARY KEY(scope,entity_type,entity_id));
CREATE TABLE IF NOT EXISTS remote_conflicts(scope TEXT,entity_type TEXT,entity_id TEXT,remote TEXT,PRIMARY KEY(scope,entity_type,entity_id));
`;
type RecordRow={entityType:string;entityId:string;payload:any;deletedAt:string|null};
async function dbReady(){const db=await database();await db.execAsync(SYNC_SCHEMA+REMOTE_SCHEMA);return db;}
async function transaction<T>(work:(db:any)=>Promise<T>):Promise<T>{return locked(async()=>{const db=await dbReady();let result:T;const execute=async(tx:any)=>{result=await work(tx);};if(Platform.OS==='web')await db.withTransactionAsync(()=>execute(db));else await db.withExclusiveTransactionAsync(execute);return result!;});}
export async function localRows(db:any,scope:string):Promise<RecordRow[]>{
 const records=await db.getAllAsync('SELECT id,payload FROM pluggy_records WHERE scope=?',scope),annotations=await db.getAllAsync('SELECT id,payload FROM pluggy_annotations WHERE scope=?',scope),entities=await db.getAllAsync("SELECT * FROM entity_records WHERE entity_type<>'@preferences'");
 const tombstones=await db.getAllAsync('SELECT * FROM remote_tombstones WHERE scope=?',scope);
 const result:RecordRow[]=[...records.map((r:any)=>({entityType:'bank_records',entityId:r.id,payload:JSON.parse(r.payload),deletedAt:null})),...annotations.map((r:any)=>({entityType:'annotations',entityId:r.id,payload:JSON.parse(r.payload),deletedAt:null})),...entities.filter((r:any)=>r.entity_type!==CLOUD_PREFERENCES_TYPE).map((r:any)=>({entityType:'entities',entityId:JSON.stringify([r.entity_type,r.id]),payload:JSON.parse(r.payload),deletedAt:r.deleted_at})),...await cloudPreferenceRows(db,scope)];
 return result.map(row=>{const marker=tombstones.find((r:any)=>r.entity_type===row.entityType&&r.entity_id===row.entityId);return marker&&canonical(row.payload)===marker.local_payload?{...row,payload:JSON.parse(marker.payload),deletedAt:marker.deleted_at}:row;});
}
const key=(r:RecordRow)=>r.entityType+'|'+r.entityId;
const same=(a:{payload:any;deletedAt?:string|null}|undefined,b:{payload:any;deletedAt?:string|null}|undefined)=>!!a&&!!b&&canonical(a.payload)===canonical(b.payload)&&(a.deletedAt||null)===(b.deletedAt||null);
async function shadow(db:any,scope:string,row:any){await db.runAsync('INSERT INTO remote_shadow VALUES(?,?,?,?,?,?) ON CONFLICT(scope,entity_type,entity_id) DO UPDATE SET version=excluded.version,payload=excluded.payload,deleted_at=excluded.deleted_at',scope,row.entityType,row.entityId,row.version,canonical(row.payload),row.deletedAt||null);}
async function materialize(db:any,scope:string,row:any){
 const payload=canonical(row.payload),now=new Date().toISOString();
 if(row.entityType==='bank_records'){
  const record=row.payload;if(record.id!==row.entityId||!['account','card','transaction','bill','reserve-position'].includes(record.kind)||!Number.isSafeInteger(record.amountCents))throw new Error('Registro bancário remoto inválido.');
  // A tombstone is kept locally, never physically deleted.
  await db.runAsync('INSERT INTO pluggy_records VALUES(?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,updated_at=excluded.updated_at',scope,row.entityId,record.kind,canonical(row.deletedAt?{...record,status:'DELETED'}:record),now);
 }else if(row.entityType==='annotations'){
  await db.runAsync('INSERT INTO pluggy_annotations VALUES(?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET payload=excluded.payload,version=pluggy_annotations.version+1,updated_at=excluded.updated_at',scope,row.entityId,row.deletedAt?canonical({_deletedAt:row.deletedAt}):payload,1,now);
 }else if(row.entityType==='entities'){
  const ids=JSON.parse(row.entityId);if(!Array.isArray(ids)||ids.length!==2||ids.some(v=>typeof v!=='string'))throw new Error('Controle remoto inválido.');
  await db.runAsync('INSERT INTO entity_records VALUES(?,?,?,?,?,?) ON CONFLICT(entity_type,id) DO UPDATE SET payload=excluded.payload,version=entity_records.version+1,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at',ids[0],ids[1],payload,1,now,row.deletedAt||null);
  if(ids[0]===CLOUD_PREFERENCES_TYPE&&!row.deletedAt)await materializeCloudPreference(db,scope,row.payload);
 }else throw new Error('Tipo remoto não suportado. Atualize o app.');
 if(row.deletedAt&&row.entityType!=='entities'){const local=row.entityType==='bank_records'?{...row.payload,status:'DELETED'}:{_deletedAt:row.deletedAt};await db.runAsync('INSERT INTO remote_tombstones VALUES(?,?,?,?,?,?) ON CONFLICT(scope,entity_type,entity_id) DO UPDATE SET payload=excluded.payload,local_payload=excluded.local_payload,deleted_at=excluded.deleted_at',scope,row.entityType,row.entityId,payload,canonical(local),row.deletedAt);}else await db.runAsync('DELETE FROM remote_tombstones WHERE scope=? AND entity_type=? AND entity_id=?',scope,row.entityType,row.entityId);
}
export async function getRemoteStatus(){return locked(async()=>{const db=await dbReady();const states=await db.getAllAsync<any>('SELECT * FROM remote_state');const conflicts=await db.getAllAsync<any>('SELECT scope,entity_type,entity_id,remote FROM remote_conflicts');const queues=await db.getAllAsync<any>('SELECT scope,COUNT(*) AS count FROM remote_queue GROUP BY scope');return {states,conflicts,queues};});}
export async function configureRemote(scope:string,enabled:boolean){await transaction(async db=>{await db.runAsync('INSERT INTO remote_state(scope,enabled) VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET enabled=excluded.enabled',scope,enabled?1:0);});}
export async function captureLocal(scope:string){return transaction(async db=>{
 const rows=await localRows(db,scope),shadows=await db.getAllAsync('SELECT * FROM remote_shadow WHERE scope=?',scope),pending=await db.getAllAsync('SELECT entity_type,entity_id FROM remote_queue WHERE scope=?',scope),conflicts=await db.getAllAsync('SELECT entity_type,entity_id FROM remote_conflicts WHERE scope=?',scope);
 const previous=new Map<string,any>(shadows.map((r:any)=>[r.entity_type+'|'+r.entity_id,{payload:JSON.parse(r.payload),deletedAt:r.deleted_at}])),blocked=new Set([...pending,...conflicts].map((r:any)=>r.entity_type+'|'+r.entity_id));
 for(const row of rows){if(blocked.has(key(row))||same(row,previous.get(key(row))))continue;const old=shadows.find((r:any)=>r.entity_type===row.entityType&&r.entity_id===row.entityId);await db.runAsync('INSERT INTO remote_queue VALUES(?,?,?,?,?,?,?)',scope,Crypto.randomUUID(),row.entityType,row.entityId,old?.version||0,canonical(row.payload),row.deletedAt);}
});}
export async function pendingOperations(scope:string){return locked(async()=>{const db=await dbReady();const rows=await db.getAllAsync<any>('SELECT * FROM remote_queue WHERE scope=? ORDER BY rowid LIMIT 20',scope);const operations:any[]=[];for(const r of rows){const operation={operationId:r.operation_id,entityType:r.entity_type,entityId:r.entity_id,baseVersion:r.base_version,payload:JSON.parse(r.payload),deletedAt:r.deleted_at};if(utf8ToBytes(JSON.stringify({operations:[...operations,operation]})).length>60000){if(!operations.length)throw Error('Registro grande demais para sincronizar.');break;}operations.push(operation);}return operations;});}
export async function applyResults(scope:string,operations:any[],results:any[]){return transaction(async db=>{
 for(const op of operations){const result=results.find(r=>r.operationId===op.operationId);if(!result)throw new Error('Resposta incompleta do sincronismo.');if(result.status===200){await shadow(db,scope,{...op,version:result.version});await db.runAsync('DELETE FROM remote_queue WHERE operation_id=? AND scope=?',op.operationId,scope);}else if(result.error==='VERSION_CONFLICT'&&result.remote){if(same(op,result.remote)){await shadow(db,scope,{...op,...result.remote});await db.runAsync('DELETE FROM remote_queue WHERE operation_id=? AND scope=?',op.operationId,scope);continue;}await db.runAsync('INSERT INTO remote_conflicts VALUES(?,?,?,?) ON CONFLICT(scope,entity_type,entity_id) DO UPDATE SET remote=excluded.remote',scope,op.entityType,op.entityId,canonical({...op,...result.remote}));await db.runAsync('DELETE FROM remote_queue WHERE operation_id=? AND scope=?',op.operationId,scope);}else throw new Error('Operação recusada pelo servidor; fila mantida.');}
});}
export async function mergeChanges(scope:string,changes:any[],cursor:number){return transaction(async db=>{
 const local=new Map((await localRows(db,scope)).map(row=>[key(row),row]));
 for(const row of changes){const old=await db.getFirstAsync('SELECT * FROM remote_shadow WHERE scope=? AND entity_type=? AND entity_id=?',scope,row.entityType,row.entityId);if(old&&old.version>=row.version)continue;
  const own=await db.getFirstAsync('SELECT operation_id FROM remote_queue WHERE scope=? AND entity_type=? AND entity_id=?',scope,row.entityType,row.entityId);if(own?.operation_id===row.operationId){await shadow(db,scope,row);continue;}
  const existing=local.get(key(row)),baseline=old?{payload:JSON.parse(old.payload),deletedAt:old.deleted_at}:undefined;
  if(existing&&!same(existing,baseline)&&!same(existing,row)){
   await db.runAsync('INSERT INTO remote_conflicts VALUES(?,?,?,?) ON CONFLICT(scope,entity_type,entity_id) DO UPDATE SET remote=excluded.remote',scope,row.entityType,row.entityId,canonical(row));
   // An in-flight operation keeps its ID until its acknowledgement is known.
  }else{await materialize(db,scope,row);await shadow(db,scope,row);local.set(key(row),row);await db.runAsync('DELETE FROM remote_conflicts WHERE scope=? AND entity_type=? AND entity_id=?',scope,row.entityType,row.entityId);}
 }
 await db.runAsync('UPDATE remote_state SET cursor=? WHERE scope=?',cursor,scope);
 const meta=await db.getFirstAsync('SELECT payload FROM pluggy_sync WHERE scope=?',scope);if(!meta){await db.runAsync('INSERT INTO pluggy_sync VALUES(?,?)',scope,JSON.stringify({scope,syncedAt:new Date().toISOString(),warnings:[]}));}
 await db.runAsync("INSERT INTO pluggy_sync VALUES('@active',?) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload",JSON.stringify({scope}));
});}
export async function resolveRemote(scope:string,entityType:string,entityId:string,choice:'local'|'remote'){await transaction(async db=>{
 const conflict=await db.getFirstAsync('SELECT remote FROM remote_conflicts WHERE scope=? AND entity_type=? AND entity_id=?',scope,entityType,entityId);if(!conflict)return;const row=JSON.parse(conflict.remote);
 if(choice==='remote')await materialize(db,scope,row);
 await shadow(db,scope,row);await db.runAsync('DELETE FROM remote_queue WHERE scope=? AND entity_type=? AND entity_id=?',scope,entityType,entityId);await db.runAsync('DELETE FROM remote_conflicts WHERE scope=? AND entity_type=? AND entity_id=?',scope,entityType,entityId);
 });await captureLocal(scope);}
export async function remoteOutcome(scope:string,error?:string){await transaction(async db=>{await db.runAsync('UPDATE remote_state SET error=?,last_success=CASE WHEN ? IS NULL THEN ? ELSE last_success END WHERE scope=?',error||null,error||null,new Date().toISOString(),scope);});}
