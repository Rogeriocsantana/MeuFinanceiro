import {sha256} from '@noble/hashes/sha256';
import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils';
const schema="CREATE TABLE IF NOT EXISTS device_preferences(scope TEXT NOT NULL,key TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),updated_at TEXT NOT NULL,PRIMARY KEY(scope,key));";
export const CLOUD_PREFERENCES_TYPE='@preferences';
const allowed=(key:string)=>key==='app'||/^person-photo:[^\u0000-\u001f]{1,200}$/.test(key);
/** Small ordinary entity records keep the existing D1 protocol and request limit. */
export async function cloudPreferenceRows(db:any,scope:string){
 await db.execAsync(schema);const rows=await db.getAllAsync('SELECT key,payload,updated_at FROM device_preferences WHERE scope=?',scope),out:any[]=[];
 for(const row of rows){if(!allowed(row.key))continue;const serialized=String(row.payload),generation=bytesToHex(sha256(utf8ToBytes(serialized))),total=Math.max(1,Math.ceil(serialized.length/24000));
  for(let i=0;i<total;i++)out.push({entityType:'entities',entityId:JSON.stringify([CLOUD_PREFERENCES_TYPE,row.key+':'+i]),payload:{key:row.key,generation,index:i,total,chunk:serialized.slice(i*24000,(i+1)*24000),updatedAt:row.updated_at},deletedAt:null});
 }
 return out;
}
export async function materializeCloudPreference(db:any,scope:string,part:any){
 if(!part||!allowed(part.key)||!Number.isInteger(part.index)||!Number.isInteger(part.total)||part.total<1||part.total>20||part.index<0||part.index>=part.total||typeof part.chunk!=='string'||part.chunk.length>24000||!/^([a-f0-9]{64})$/.test(part.generation)||!Number.isFinite(Date.parse(part.updatedAt)))throw Error('Preferência remota inválida.');
 await db.execAsync(schema);
 const rows=await db.getAllAsync('SELECT payload FROM entity_records WHERE entity_type=? AND substr(id,1,?)=? AND deleted_at IS NULL',CLOUD_PREFERENCES_TYPE,part.key.length+1,part.key+':'),parts=rows.map((r:any)=>JSON.parse(r.payload)).filter((p:any)=>p.key===part.key&&p.generation===part.generation&&p.total===part.total);
 const unique=new Map<number,any>(parts.map((p:any)=>[p.index,p]));if(unique.size!==part.total)return;
 const serialized=Array.from({length:part.total},(_,i)=>unique.get(i)?.chunk??'').join('');if(bytesToHex(sha256(utf8ToBytes(serialized)))!==part.generation)throw Error('Foto ou preferência remota incompleta.');
 let value:any;try{value=JSON.parse(serialized);}catch{throw Error('Preferência remota inválida.');}
 if(part.key.startsWith('person-photo:')&&value!==null&&(typeof value!=='string'||value.length>341336||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)))throw Error('Foto remota inválida.');
 const old=await db.getFirstAsync('SELECT payload,updated_at FROM device_preferences WHERE scope=? AND key=?',scope,part.key);if(old?.payload===serialized)return;
 // A delayed remote generation must not erase a newer edit saved on this device.
 if(old&&Date.parse(old.updated_at)>Date.parse(part.updatedAt))return;
 await db.runAsync('INSERT INTO device_preferences VALUES(?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',scope,part.key,serialized,part.updatedAt);
}
