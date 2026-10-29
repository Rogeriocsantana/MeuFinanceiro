import {installmentInfo,installmentAmountsCompatible} from './installmentContinuity';
import {installmentDueDateChanges,fixedCardDueDay} from './installmentContinuity';
import {Platform} from 'react-native';
import * as Crypto from 'expo-crypto';
import {database} from './database';
import {locked} from './pluggyRepository';
import {queueRemoteEdit} from './queueRemoteEdit';
import {SYNC_SCHEMA,type LocalBankData,type LocalAnnotation} from './pluggyModel';
import {purchaseIdentity,purchaseFamily,purchaseSeriesChanges,validatePurchaseLabel,type PurchaseSeries} from './purchaseSeries';
import type {Control} from './localControls';

async function atomic<T>(work:(tx:any)=>Promise<T>){return locked(async()=>{
 const db=await database();await db.execAsync(SYNC_SCHEMA);let result:T;
 const run=async(tx:any)=>{result=await work(tx);};
 if(Platform.OS==='web')await db.withTransactionAsync(()=>run(db));else await db.withExclusiveTransactionAsync(run);
 return result!;
});}
async function read(tx:any,scope:string){
 const active=await tx.getFirstAsync("SELECT payload FROM pluggy_sync WHERE scope='@active'");
 if(!scope||!active||JSON.parse(active.payload).scope!==scope)throw Error('A conexão não corresponde aos dados locais.');
 const records=(await tx.getAllAsync('SELECT payload FROM pluggy_records WHERE scope=?',scope)).map((r:any)=>JSON.parse(r.payload));
 const annotations=Object.fromEntries((await tx.getAllAsync('SELECT id,payload FROM pluggy_annotations WHERE scope=?',scope)).map((r:any)=>[r.id,JSON.parse(r.payload)]));
 const controls:Control[]=(await tx.getAllAsync("SELECT entity_type,id,payload FROM entity_records WHERE deleted_at IS NULL AND entity_type<>'@preferences'")).map((r:any)=>({...JSON.parse(r.payload),id:r.id,type:r.entity_type}));
 return {data:{scope,records,annotations,syncedAt:'',warnings:[]} as LocalBankData,controls};
}
async function writeAnnotation(tx:any,scope:string,id:string,note:LocalAnnotation){
 const payload=JSON.stringify(note),now=new Date().toISOString();
 await tx.runAsync('INSERT INTO pluggy_annotations VALUES(?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET payload=excluded.payload,version=pluggy_annotations.version+1,updated_at=excluded.updated_at',scope,id,payload,1,now);
 await queueRemoteEdit(tx,scope,'annotations',id,payload);
}
export async function savePurchaseSeries(scope:string,transactionId:string,patch:{label?:string;ownerId?:string|null;dueDay?:number;classification?:{nature:string;categoryId:string};anchorAnnotation?:LocalAnnotation}){
 return atomic(async tx=>{
  const {data,controls}=await read(tx,scope),anchor=data.records.find(r=>r.id===transactionId);
  if(!anchor)throw Error('Compra não encontrada.');
  const family=purchaseFamily(data,anchor),matches=controls.filter(c=>c.type==='purchase-series'&&c.scope===scope&&(c.identity===family.identity||family.members.some(m=>m.id===c.sourceTransactionId))&&(()=>{const source=data.records.find(r=>r.id===c.sourceTransactionId),info=source&&installmentInfo(source,data);return !!info&&Math.abs(Number(c.anchorAmountCents)-info.amount)<=5&&installmentAmountsCompatible({...info,amount:Number(c.anchorAmountCents)},family.info);})());
  if(matches.length>1&&(patch.ownerId===undefined&&new Set(matches.map(c=>c.ownerId===undefined?'unset':c.ownerId??'self')).size>1||patch.label===undefined&&new Set(matches.map(c=>c.label||'')).size>1))throw Error('A compra tem decisões diferentes de nome ou dono. Confira antes de alterar.');
  const previous=matches[0] as PurchaseSeries|undefined;
  if(patch.ownerId!==undefined&&patch.ownerId!==null&&(typeof patch.ownerId!=='string'||!patch.ownerId))throw Error('Pessoa inválida.');
  if(patch.dueDay!==undefined&&(!Number.isInteger(patch.dueDay)||patch.dueDay<1||patch.dueDay>31))throw Error('Informe um dia de vencimento entre 1 e 31.');
  const series:PurchaseSeries={...previous,id:previous?.id||Crypto.randomUUID(),type:'purchase-series',name:'Compra parcelada',scope,sourceTransactionId:previous?.sourceTransactionId||anchor.id,identity:family.identity,anchorAmountCents:previous?.anchorAmountCents??family.info.amount,label:patch.label===undefined?previous?.label||'':validatePurchaseLabel(patch.label),...(patch.ownerId!==undefined?{ownerId:patch.ownerId}:{})};
  if(patch.dueDay!==undefined)series.dueDay=patch.dueDay;
  if(patch.classification)series.classification=patch.classification;
  // Editing only the label must never reassign or rewrite settled financial shares.
  const decision=patch.ownerId===undefined?{...series,ownerId:undefined}:series;
  const plan=purchaseSeriesChanges(data,controls,decision,true);
  if(plan.conflicts.length)throw Error(plan.conflicts.map(c=>c.reason).filter((v,i,a)=>a.indexOf(v)===i).join(' '));
  const payload=JSON.stringify(series),now=new Date().toISOString();
  if(!previous||JSON.stringify(previous)!==payload){
   await tx.runAsync('INSERT INTO entity_records VALUES(?,?,?,?,?,?) ON CONFLICT(entity_type,id) DO UPDATE SET payload=excluded.payload,version=entity_records.version+1,updated_at=excluded.updated_at,deleted_at=NULL',series.type,series.id,payload,1,now,null);
   await queueRemoteEdit(tx,scope,'entities',JSON.stringify([series.type,series.id]),payload);
  }
  // Keep older decisions from previously split groups consistent after the grouping repair.
  for(const duplicate of matches.slice(1)){const updated={...duplicate,label:series.label,identity:family.identity,...(patch.classification?{classification:patch.classification}:{}),...(patch.ownerId!==undefined?{ownerId:patch.ownerId}:{})};const value=JSON.stringify(updated);if(value!==JSON.stringify(duplicate)){await tx.runAsync('UPDATE entity_records SET payload=?,version=version+1,updated_at=? WHERE entity_type=? AND id=?',value,now,'purchase-series',duplicate.id);await queueRemoteEdit(tx,scope,'entities',JSON.stringify(['purchase-series',duplicate.id]),value);}}
  if(patch.anchorAnnotation){const change=plan.changes.find(c=>c.id===anchor.id),annotation={...patch.anchorAnnotation,...(patch.classification||{})};if(change)change.annotation={...change.annotation,...annotation};else plan.changes.push({id:anchor.id,annotation:{...(data.annotations[anchor.id]||{}),...annotation}});}
  const projected={...data,annotations:{...data.annotations,...Object.fromEntries(plan.changes.map(c=>[c.id,c.annotation]))}};
  for(const aligned of installmentDueDateChanges(projected,controls)){
   const planned=plan.changes.find(c=>c.id===aligned.id);if(planned)planned.annotation=aligned.annotation;else plan.changes.push(aligned);
  }
  for(const change of plan.changes)await writeAnnotation(tx,scope,change.id,change.annotation);
  if(plan.changes.length||!previous||JSON.stringify(previous)!==payload)await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");
  return {series,changed:plan.changes.length};
 });
}
/** Reapply durable decisions to newly imported parcels, without changing manual divisions. */
export async function applySavedPurchaseSeries(scope:string){return atomic(async tx=>{
 const {data,controls}=await read(tx,scope),conflicts:{id:string;reason:string}[]=[];let changed=0;
 const saved=controls.filter(c=>c.type==='purchase-series'&&c.scope===scope) as PurchaseSeries[],appliedFamilies=new Set<string>();
 for(const series of saved){
  if(saved.some(other=>other.id!==series.id&&(other.label!==series.label||other.ownerId!==series.ownerId||JSON.stringify(other.classification)!==JSON.stringify(series.classification))&&(other.identity===series.identity||(data.records.find(r=>r.id===other.sourceTransactionId)?purchaseIdentity(data.records.find(r=>r.id===other.sourceTransactionId)!,data):other.id)===(data.records.find(r=>r.id===series.sourceTransactionId)?purchaseIdentity(data.records.find(r=>r.id===series.sourceTransactionId)!,data):series.id))&&Math.abs(other.anchorAmountCents-series.anchorAmountCents)<=10)){
   conflicts.push({id:series.id,reason:'Decisões de compra concorrentes. Confira antes de reaplicar.'});continue;
  }
  const anchor=data.records.find(r=>r.id===series.sourceTransactionId),familyKey=(anchor?purchaseIdentity(anchor,data):series.identity)+'|'+series.anchorAmountCents;if(appliedFamilies.has(familyKey))continue;appliedFamilies.add(familyKey);
  let plan:ReturnType<typeof purchaseSeriesChanges>;
  try{plan=purchaseSeriesChanges(data,controls,series);}catch(error){conflicts.push({id:series.id,reason:error instanceof Error?error.message:'Confira a compra parcelada.'});continue;}
  conflicts.push(...plan.conflicts);
  for(const change of plan.changes){await writeAnnotation(tx,scope,change.id,change.annotation);data.annotations[change.id]=change.annotation;changed++;}
 }
 for(const change of installmentDueDateChanges(data,controls)){await writeAnnotation(tx,scope,change.id,change.annotation);data.annotations[change.id]=change.annotation;changed++;}
 const meta=await tx.getFirstAsync('SELECT payload FROM pluggy_sync WHERE scope=?',scope);
 if(meta){const state=JSON.parse(meta.payload);state.warnings=[...(state.warnings||[]).filter((w:string)=>!w.startsWith('Compra parcelada para conferir: ')),...new Set(conflicts.map(c=>'Compra parcelada para conferir: '+c.reason))];const payload=JSON.stringify(state);if(payload!==meta.payload){await tx.runAsync('UPDATE pluggy_sync SET payload=? WHERE scope=?',payload,scope);if(!changed)await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");}}
 if(changed)await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");
 return {changed,conflicts};
});}

/** Correct existing imported installment dates on startup without reclassifying financial events. */
export async function alignInstallmentDueDates(scope:string){return atomic(async tx=>{
 const {data,controls}=await read(tx,scope);let settingsChanged=0;
 for(const card of data.records.filter(r=>r.kind==='card')){
  const matches=controls.filter(c=>c.type==='card-settings'&&c.accountId===card.accountId&&(!c.itemId||c.itemId===card.itemId));
  if(matches.length>1||matches.length===1&&Number(matches[0]!.dueDay)>=1&&Number(matches[0]!.dueDay)<=31)continue;
  const setting:Control={...matches[0],id:matches[0]?.id||Crypto.randomUUID(),type:'card-settings',name:matches[0]?.name||card.name,accountId:card.accountId,itemId:card.itemId,dueDay:fixedCardDueDay(card,data,controls)};
  const payload=JSON.stringify(setting),now=new Date().toISOString();
  await tx.runAsync('INSERT INTO entity_records VALUES(?,?,?,?,?,?) ON CONFLICT(entity_type,id) DO UPDATE SET payload=excluded.payload,version=entity_records.version+1,updated_at=excluded.updated_at,deleted_at=NULL',setting.type,setting.id,payload,1,now,null);
  await queueRemoteEdit(tx,scope,'entities',JSON.stringify([setting.type,setting.id]),payload);
  const index=controls.findIndex(c=>c.id===setting.id);if(index>=0)controls[index]=setting;else controls.push(setting);settingsChanged++;
 }
 const changes=installmentDueDateChanges(data,controls);
 for(const change of changes)await writeAnnotation(tx,scope,change.id,change.annotation);
 if(changes.length||settingsChanged)await tx.runAsync("UPDATE local_meta SET value=value+1 WHERE key='revision'");
 return {changed:changes.length+settingsChanged};
});}
