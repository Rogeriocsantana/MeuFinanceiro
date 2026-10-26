import * as Crypto from 'expo-crypto';
// Runs inside the caller's SQLite transaction. Keeping an older operation ID is
// essential when its acknowledgement may have been lost; captureLocal queues
// the latest value once that operation has been acknowledged.
export async function queueRemoteEdit(tx:any,scope:string,type:string,id:string,payload:string){
 if(!await tx.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='remote_state'"))return;
 const enabled=await tx.getFirstAsync('SELECT enabled FROM remote_state WHERE scope=?',scope);if(!enabled?.enabled)return;
 const shadow=await tx.getFirstAsync('SELECT version FROM remote_shadow WHERE scope=? AND entity_type=? AND entity_id=?',scope,type,id);
 await tx.runAsync('INSERT OR IGNORE INTO remote_queue VALUES(?,?,?,?,?,?,?)',scope,Crypto.randomUUID(),type,id,shadow?.version||0,payload,null);
}
