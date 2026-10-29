import type {BankRecord,BankSnapshot,LocalAnnotation} from './pluggyModel';

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
export function protectBankIdentity(snapshot:BankSnapshot,previous:BankRecord[],notes:Map<string,LocalAnnotation>,controls:Record<string,any>[]=[]):BankSnapshot{
 const protectedIds=new Set([...notes].filter(([,note])=>note.shares?.length||note.controlId||Object.keys(note.links||{}).length||note.compensations?.length||note.receiptRemainder||(note as any).receiptRounding||note.event&&note.event!=='Nenhum evento').map(([id])=>id));
 for(const row of previous)if(controls.some(c=>['bankRecordId','sourceBankRecordId','transactionId','sourceTransactionId'].some(key=>c[key]===row.id)||typeof c.controlId==='string'&&c.controlId.startsWith('share:'+row.id+':')))protectedIds.add(row.id);
 const protectedRows=previous.filter(r=>r.kind==='transaction'&&protectedIds.has(r.id));
 const seen=new Set<string>();
 const records=snapshot.records.map(row=>{
  const exact=previous.find(p=>p.id===row.id);
  const known=exact?[exact]:previous.filter(p=>p.kind==='transaction'&&sameAccount(p,row)&&(
   Array.isArray(p.metadata.sourceRecordAliases)&&p.metadata.sourceRecordAliases.includes(row.id)||
   !!p.metadata.sourceId&&p.metadata.sourceId===row.metadata.sourceId
  ));
  if(known.length>1)throw Error('A origem alterou identificadores de lançamentos vinculados. Atualização cancelada; quitações e recebimentos preservados. Confira a correspondência antes de importar.');
  const old=known[0];
  if(old){
   if(!sameAccount(old,row))throw Error('A origem mudou a conta de um lançamento salvo. Atualização cancelada; vínculos preservados.');
   if(seen.has(old.id))throw Error('A origem enviou dois identificadores para um lançamento vinculado. Atualização cancelada; quitações preservadas. Confira a correspondência.');
   seen.add(old.id);
   const aliases=[...new Set([...(Array.isArray(old.metadata.sourceRecordAliases)?old.metadata.sourceRecordAliases:[]),...(row.id!==old.id?[row.id]:[])])];
   return aliases.length?{...row,id:old.id,metadata:{...row.metadata,sourceRecordAliases:aliases}}:row;
  }
  if(['POSTED','PENDING'].includes(row.status)){
   const candidates=protectedRows.filter(p=>possibleReplacement(p,row));
   if(candidates.length)throw Error('Possível troca de identificador em “'+row.name+'”. Atualização cancelada para não duplicar uma parcela ou perder sua quitação. Os recebimentos e vínculos anteriores foram preservados; confira a correspondência antes de importar.');
  }
  return row;
 });
 return {...snapshot,records};
}
