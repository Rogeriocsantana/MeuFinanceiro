import {Platform} from 'react-native';
import {database} from './database';
import {locked} from './pluggyRepository';

// Profile, photos and chosen preferences sync as portable data; device event ledgers and refresh state stay local.
export const PREFERENCES_SCHEMA=`
CREATE TABLE IF NOT EXISTS device_preferences(scope TEXT NOT NULL,key TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),updated_at TEXT NOT NULL,PRIMARY KEY(scope,key));
CREATE TABLE IF NOT EXISTS device_events(scope TEXT NOT NULL,key TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),updated_at TEXT NOT NULL,PRIMARY KEY(scope,key));
`;
export type AppPreferences={profile:{name:string;photo:string|null};refresh:{intervalMinutes:number|null};notifications:{enabled:boolean;types:string[]}};
export const defaultAppPreferences=():AppPreferences=>({profile:{name:'',photo:null},refresh:{intervalMinutes:null},notifications:{enabled:false,types:[]}});
export function validatePhoto(photo:string|null){
 if(photo!==null&&(typeof photo!=='string'||photo.length>341336||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)))throw Error('Use uma foto PNG, JPEG ou WebP compactada de até 250 KB.');
 return photo;
}
export function validatePreferences(value:AppPreferences):AppPreferences{
 if(typeof value?.profile?.name!=='string'||value.profile.name.trim().length>80||/[\u0000-\u001f]/.test(value.profile.name))throw Error('Informe um nome com até 80 caracteres.');
 const interval=value?.refresh?.intervalMinutes;
 if(interval!==null&&(!Number.isInteger(interval)||interval<15||interval>1440))throw Error('Escolha um intervalo entre 15 minutos e 24 horas ou atualização manual.');
 if(typeof value?.notifications?.enabled!=='boolean'||!Array.isArray(value.notifications.types)||value.notifications.types.length>20||value.notifications.types.some(t=>typeof t!=='string'||!/^[-a-z0-9]{1,50}$/.test(t)))throw Error('Preferências de notificação inválidas.');
 return {profile:{name:value.profile.name.trim(),photo:validatePhoto(value.profile.photo)},refresh:{intervalMinutes:interval},notifications:{enabled:value.notifications.enabled,types:[...new Set(value.notifications.types)].sort()}};
}
async function access<T>(scope:string,work:(tx:any)=>Promise<T>){return locked(async()=>{
 if(!scope.trim())throw Error('Conexão inválida.');
 const db=await database();await db.execAsync(PREFERENCES_SCHEMA);let result:T;
 const run=async(tx:any)=>{
  const exists=await tx.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='pluggy_sync'");
  const active=exists&&await tx.getFirstAsync("SELECT payload FROM pluggy_sync WHERE scope='@active'");
  if(active&&JSON.parse(active.payload).scope!==scope)throw Error('A conexão não corresponde aos dados locais.');
  result=await work(tx);
 };
 if(Platform.OS==='web')await db.withTransactionAsync(()=>run(db));else await db.withExclusiveTransactionAsync(run);
 return result!;
});}
async function put(tx:any,scope:string,key:string,value:unknown){
 const payload=JSON.stringify(value),old=await tx.getFirstAsync('SELECT payload FROM device_preferences WHERE scope=? AND key=?',scope,key);
 if(old?.payload===payload)return;
 await tx.runAsync('INSERT INTO device_preferences VALUES(?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',scope,key,payload,new Date().toISOString());
 await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");
}
export async function loadAppPreferences(scope:string):Promise<AppPreferences>{return access(scope,async tx=>{
 const row=await tx.getFirstAsync("SELECT payload FROM device_preferences WHERE scope=? AND key='app'",scope);
 return row?validatePreferences(JSON.parse(row.payload)):defaultAppPreferences();
});}
export async function saveAppPreferences(scope:string,value:AppPreferences){const next=validatePreferences(value);await access(scope,tx=>put(tx,scope,'app',next));return next;}
export async function savePersonPhoto(scope:string,personId:string,photo:string|null){validatePhoto(photo);await access(scope,async tx=>{
 const person=await tx.getFirstAsync("SELECT id FROM entity_records WHERE entity_type='people' AND id=? AND deleted_at IS NULL",personId);
 if(!person)throw Error('Pessoa não encontrada.');
 await put(tx,scope,'person-photo:'+personId,photo);
});}
export async function loadPersonPhoto(scope:string,personId:string):Promise<string|null>{return access(scope,async tx=>{
 const row=await tx.getFirstAsync('SELECT payload FROM device_preferences WHERE scope=? AND key=?',scope,'person-photo:'+personId);return row?JSON.parse(row.payload):null;
});}
export async function loadRefreshState(scope:string):Promise<{lastAttemptAt?:string;lastSuccessAt?:string}>{return access(scope,async tx=>{
 const row=await tx.getFirstAsync("SELECT payload FROM device_preferences WHERE scope=? AND key='refresh-state'",scope);return row?JSON.parse(row.payload):{};
});}
export async function saveRefreshState(scope:string,value:{lastAttemptAt?:string;lastSuccessAt?:string}){
 for(const date of [value.lastAttemptAt,value.lastSuccessAt])if(date!==undefined&&!Number.isFinite(Date.parse(date)))throw Error('Data de atualização inválida.');
 await access(scope,tx=>put(tx,scope,'refresh-state',value));
}
/** Durable deduplication ledger; the native adapter must reuse key as its notification identifier. */
export async function recordDeviceEvent(scope:string,key:string,payload:Record<string,unknown>){
 if(!/^[\w:.-]{1,200}$/.test(key))throw Error('Identificador de evento inválido.');
 return access(scope,async tx=>{const result=await tx.runAsync('INSERT OR IGNORE INTO device_events VALUES(?,?,?,?)',scope,key,JSON.stringify(payload),new Date().toISOString());if(result.changes)await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");return !!result.changes;});
}

export async function loadDeviceEvent(scope:string,key:string){return access(scope,async tx=>{const row=await tx.getFirstAsync('SELECT payload FROM device_events WHERE scope=? AND key=?',scope,key);return row?JSON.parse(row.payload):null;});}
export async function saveDeviceEvent(scope:string,key:string,payload:Record<string,unknown>){return access(scope,async tx=>{await tx.runAsync('INSERT INTO device_events VALUES(?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',scope,key,JSON.stringify(payload),new Date().toISOString());});}
export async function forgetDeviceEvent(scope:string,key:string){return access(scope,async tx=>{await tx.runAsync('DELETE FROM device_events WHERE scope=? AND key=?',scope,key);});}
