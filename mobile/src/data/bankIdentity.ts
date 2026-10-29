import type {BankRecord,BankSnapshot,LocalAnnotation} from './pluggyModel';
export type IdentityDecision={recordId:string;choice:'same'|'separate';matchedId?:string};
export class BankIdentityConflict extends Error{
 constructor(public recordId:string,public candidateIds:string[],message:string){super(message);this.name='BankIdentityConflict';}
}

const sameAccount=(a:BankRecord,b:BankRecord)=>a.itemId===b.itemId&&a.accountId===b.accountId&&a.kind===b.kind;
const text=(value:unknown)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
function fingerprint(row:BankRecord){
 const day=String(row.metadata.purchaseDate||row.metadata.transactionDateTime||row.date).slice(0,10);
 if(row.kind!=='transaction'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!text(row.name))return null;
 return JSON.stringify([row.currency,row.amountCents,day,row.invoiceMonth||'',text(row.name),row.metadata.installmentNumber||null,row.metadata.totalInstallments||null,!!row.metadata.card]);
}
function possibleReplacement(a:BankRecord,b:BankRecord){
 if(!sameAccount(a,b)||a.currency!==b.currency||!!a.metadata.card!==!!b.metadata.card)return false;
 if(a.metadata.card&&((a.invoiceMonth&&b.invoiceMonth&&a.invoiceMonth!==b.invoiceMonth)||(a.metadata.installmentNumber&&b.metadata.installmentNumber&&a.metadata.installmentNumber!==b.metadata.installmentNumber)||(a.metadata.totalInstallments&&b.metadata.totalInstallments&&a.metadata.totalInstallments!==b.metadata.totalInstallments)))return false;
 if(fingerprint(a)===fingerprint(b))return true;
 const sameAmount=a.amountCents===b.amountCents;
 const day=(r:BankRecord)=>String(r.metadata.purchaseDate||r.metadata.transactionDateTime||r.date).slice(0,10);
 if(sameAmount&&day(a)===day(b))return true;
 return sameAmount&&!!a.invoiceMonth&&a.invoiceMonth===b.invoiceMonth&&Number(a.metadata.totalInstallments)>=2&&a.metadata.totalInstallments===b.metadata.totalInstallments&&a.metadata.installmentNumber===b.metadata.installmentNumber;
}

/** Keep local ids immutable. An uncertain replacement must never create a second, unpaid obligation. */
export function protectBankIdentity(snapshot:BankSnapshot,previous:BankRecord[],notes:Map<string,LocalAnnotation>,controls:Record<string,any>[]=[],decisions:IdentityDecision[]=[]):BankSnapshot{
 const protectedIds=new Set([...notes].filter(([,note])=>note.shares?.length||note.controlId||Object.keys(note.links||{}).length||note.compensations?.length||note.receiptRemainder||(note as any).receiptRounding||note.event&&note.event!=='Nenhum evento').map(([id])=>id));
 for(const row of previous)if(controls.some(c=>['bankRecordId','sourceBankRecordId','transactionId','sourceTransactionId'].some(key=>c[key]===row.id)||typeof c.controlId==='string'&&c.controlId.startsWith('share:'+row.id+':')))protectedIds.add(row.id);
 const protectedRows=previous.filter(r=>r.kind==='transaction'&&protectedIds.has(r.id));
 const sameDecisions=decisions.filter(d=>d.choice==='same');
 const targets=sameDecisions.map(d=>d.matchedId);if(new Set(targets).size!==targets.length)throw Error('O mesmo lançamento salvo não pode ser usado em duas correspondências.');
 const suppressed=new Set(sameDecisions.filter(d=>snapshot.records.some(r=>r.id===d.recordId)).map(d=>d.matchedId));
 for(const old of previous){const preferred=old.metadata.identityPreferredSourceId;if(preferred&&preferred!==old.id&&snapshot.records.some(r=>r.id===preferred))suppressed.add(old.id);}
 const seen=new Set<string>();
 const records=snapshot.records.filter(row=>!suppressed.has(row.id)).map(row=>{
  const decision=decisions.find(d=>d.recordId===row.id);
  if(decision?.choice==='separate')return {...row,metadata:{...row.metadata,identitySeparateRoot:row.id,identityReviewedAt:snapshot.syncedAt}};
  if(decision?.choice==='same'){
   const target=previous.find(p=>p.id===decision.matchedId);if(!target||!sameAccount(target,row))throw Error('Correspondência inválida ou de outra conta.');
   if(seen.has(target.id))throw Error('O lançamento salvo já foi usado nesta importação.');seen.add(target.id);
   return {...row,id:target.id,metadata:{...row.metadata,sourceRecordAliases:[...new Set([...(target.metadata.sourceRecordAliases||[]),row.id])],identityPreferredSourceId:row.id,...(target.metadata.identitySeparateRoot?{identitySeparateRoot:target.metadata.identitySeparateRoot}:{}),identityReviewedAt:snapshot.syncedAt}};
  }
  const exact=previous.find(p=>p.id===row.id);
  const known=exact?[exact]:previous.filter(p=>p.kind==='transaction'&&sameAccount(p,row)&&(
   Array.isArray(p.metadata.sourceRecordAliases)&&p.metadata.sourceRecordAliases.includes(row.id)||
   !!p.metadata.sourceId&&p.metadata.sourceId===row.metadata.sourceId
  ));
  if(known.length>1)throw new BankIdentityConflict(row.id,known.map(p=>p.id),'A origem alterou identificadores de lançamentos vinculados. Quitações e recebimentos preservados. Confira em Open Finance e importações → Vínculos para conferir.');
  const old=known[0];
  if(old){
   if(!sameAccount(old,row))throw Error('A origem mudou a conta de um lançamento salvo. Atualização cancelada; vínculos preservados.');
   if(seen.has(old.id))throw new BankIdentityConflict(row.id,[old.id],'A origem enviou dois identificadores para um lançamento vinculado. Quitações preservadas. Confira em Vínculos para conferir.');
   seen.add(old.id);
   const aliases=[...new Set([...(Array.isArray(old.metadata.sourceRecordAliases)?old.metadata.sourceRecordAliases:[]),...(row.id!==old.id?[row.id]:[])])];
   const local={...(old.metadata.identitySeparateRoot?{identitySeparateRoot:old.metadata.identitySeparateRoot}:{}),...(old.metadata.identityReviewedAt?{identityReviewedAt:old.metadata.identityReviewedAt}:{}),...(old.metadata.identityPreferredSourceId?{identityPreferredSourceId:old.metadata.identityPreferredSourceId}:{})};
   return {...row,id:old.id,metadata:{...row.metadata,...local,...(aliases.length?{sourceRecordAliases:aliases,identityPreferredSourceId:row.id!==old.id?row.id:old.metadata.identityPreferredSourceId||aliases[aliases.length-1]}:{})}};
  }
  if(['POSTED','PENDING'].includes(row.status)){
   const candidates=protectedRows.filter(p=>possibleReplacement(p,row));
   if(candidates.length)throw new BankIdentityConflict(row.id,candidates.map(p=>p.id),'Possível troca de identificador em “'+row.name+'”. Quitações e recebimentos preservados. Abra Open Finance e importações → Vínculos para conferir.');
  }
  return row;
 });
 return {...snapshot,records};
}
export function identityConflicts(snapshot:BankSnapshot,previous:BankRecord[],notes:Map<string,LocalAnnotation>,controls:Record<string,any>[]=[],decisions:IdentityDecision[]=[]){
 const conflicts:{recordId:string;candidateIds:string[]}[]=[];let records=[...snapshot.records];
 for(let i=0;i<=snapshot.records.length;i++){
  try{protectBankIdentity({...snapshot,records},previous,notes,controls,decisions);return conflicts;}
  catch(error){if(!(error instanceof BankIdentityConflict)||!records.some(r=>r.id===error.recordId))throw error;conflicts.push({recordId:error.recordId,candidateIds:error.candidateIds});records=records.filter(r=>r.id!==error.recordId);}
 }
 throw Error('Não foi possível preparar a conferência.');
}
