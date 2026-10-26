const types=new Set(['bank_records','annotations','entities']);
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
export const UPSERT=`INSERT INTO sync_records(user_id,entity_type,entity_id,version,payload,deleted_at,updated_at)
 SELECT ?,?,?,1,?,?,? WHERE ?=0 AND NOT EXISTS(SELECT 1 FROM sync_changes WHERE user_id=? AND operation_id=?)
 ON CONFLICT(user_id,entity_type,entity_id) DO UPDATE SET version=sync_records.version+1,payload=excluded.payload,deleted_at=excluded.deleted_at,updated_at=excluded.updated_at
 WHERE sync_records.version=? AND NOT EXISTS(SELECT 1 FROM sync_changes WHERE user_id=? AND operation_id=?)`;
// UPDATE is separate: the insert SELECT must reject baseVersion>0 for missing entities.
export const UPDATE=`UPDATE sync_records SET version=version+1,payload=?,deleted_at=?,updated_at=? WHERE user_id=? AND entity_type=? AND entity_id=? AND version=? AND NOT EXISTS(SELECT 1 FROM sync_changes WHERE user_id=? AND operation_id=?)`;
export async function synchronize(request,db,user){
 if(!db)return response({error:'SYNC_NOT_CONFIGURED'},409);
 const url=new URL(request.url);
 if(request.method==='GET'){
  const after=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(after)||after<0)return response({error:'INVALID_CURSOR'},400);
  const {results}=await db.prepare('SELECT sequence,operation_id AS operationId,entity_type AS entityType,entity_id AS entityId,version,payload,deleted_at AS deletedAt,updated_at AS updatedAt FROM sync_changes WHERE user_id=? AND sequence>? ORDER BY sequence LIMIT 101').bind(user,after).all();
  const rows=results.slice(0,100).map(r=>({...r,payload:JSON.parse(r.payload)}));return response({changes:rows,cursor:rows.at(-1)?.sequence||after,hasMore:results.length>100});
 }
 if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return response({error:'INVALID_CONTENT_TYPE'},415);
 const reader=request.body?.getReader(),chunks=[];let bytes=0;if(reader)while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){await reader.cancel();return response({error:'PAYLOAD_TOO_LARGE'},413);}chunks.push(value);}
 let op;try{const all=new Uint8Array(bytes);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}op=JSON.parse(new TextDecoder().decode(all));}catch{return response({error:'INVALID_OPERATION'},400);}

 const batch=Array.isArray(op?.operations),operations=batch?op.operations:[op];
 if(!operations.length||operations.length>20||new Set(operations.map(o=>o?.operationId)).size!==operations.length)return response({error:'INVALID_BATCH'},400);
 const now=new Date().toISOString(),prepared=[];
 for(const operation of operations){const op=operation;
  if(!op||!types.has(op.entityType)||typeof op.entityId!=='string'||!op.entityId||op.entityId.length>1000||typeof op.operationId!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(op.operationId)||!Number.isSafeInteger(op.baseVersion)||op.baseVersion<0||!op.payload||typeof op.payload!=='object'||Array.isArray(op.payload)||!(op.deletedAt===null||typeof op.deletedAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(op.deletedAt)))return response({error:'INVALID_OPERATION'},400);
  const payload=canonical(op.payload),fingerprint=canonical({entityType:op.entityType,entityId:op.entityId,baseVersion:op.baseVersion,payload:op.payload,deletedAt:op.deletedAt});
  const first=op.baseVersion===0?db.prepare(UPSERT).bind(user,op.entityType,op.entityId,payload,op.deletedAt,now,0,user,op.operationId,0,user,op.operationId):db.prepare(UPDATE).bind(payload,op.deletedAt,now,user,op.entityType,op.entityId,op.baseVersion,user,op.operationId);
  const log=db.prepare('INSERT INTO sync_changes(user_id,operation_id,entity_type,entity_id,version,payload,deleted_at,updated_at,fingerprint) SELECT user_id,?,entity_type,entity_id,version,payload,deleted_at,updated_at,? FROM sync_records WHERE user_id=? AND entity_type=? AND entity_id=? AND changes()=1').bind(op.operationId,fingerprint,user,op.entityType,op.entityId);
  prepared.push({op,fingerprint,first,log});
 }
 await db.batch(prepared.flatMap(p=>[p.first,p.log]));
 const placeholders=prepared.map(()=>'?').join(',');
 const {results:receipts}=await db.prepare('SELECT operation_id,version,sequence,fingerprint FROM sync_changes WHERE user_id=? AND operation_id IN ('+placeholders+')').bind(user,...operations.map(op=>op.operationId)).all();
 const missing=prepared.filter(p=>!receipts.some(r=>r.operation_id===p.op.operationId));let remotes=[];
 if(missing.length){const clauses=missing.map(()=>'(entity_type=? AND entity_id=?)').join(' OR ');remotes=(await db.prepare('SELECT entity_type,entity_id,version,payload,deleted_at AS deletedAt FROM sync_records WHERE user_id=? AND ('+clauses+')').bind(user,...missing.flatMap(p=>[p.op.entityType,p.op.entityId])).all()).results;}
 const results=prepared.map(({op,fingerprint})=>{const receipt=receipts.find(r=>r.operation_id===op.operationId);if(receipt)return receipt.fingerprint===fingerprint?{operationId:op.operationId,status:200,version:receipt.version,sequence:receipt.sequence}:{operationId:op.operationId,status:409,error:'OPERATION_ID_REUSED'};const remote=remotes.find(r=>r.entity_type===op.entityType&&r.entity_id===op.entityId);return {operationId:op.operationId,status:409,error:'VERSION_CONFLICT',remote:remote?{version:remote.version,payload:JSON.parse(remote.payload),deletedAt:remote.deletedAt}:null};});
 return batch?response({results}):response(results[0],results[0].status);
}
