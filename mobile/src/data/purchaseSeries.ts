import type {BankRecord,LocalAnnotation,LocalBankData} from './pluggyModel';
import type {Control} from './localControls';
import {installmentInfo,installmentDueDate,installmentPurchaseDay,installmentPurchaseDatesCompatible,installmentAmountsCompatible} from './installmentContinuity';

export type PurchaseSeries=Control&{type:'purchase-series';scope:string;sourceTransactionId:string;identity:string;anchorAmountCents:number;label:string;ownerId?:string|null;dueDay?:number;classification?:{nature:string;categoryId:string}};
// Records are replaced on refresh; retain identities only while this snapshot is alive.
const identityCache=new WeakMap<BankRecord[],WeakMap<BankRecord,{value:string|null}>>();
export function purchaseIdentity(tx:BankRecord,data:LocalBankData){
 let cache=identityCache.get(data.records);if(!cache){cache=new WeakMap();identityCache.set(data.records,cache);}
 const cached=cache.get(tx);if(cached)return cached.value;
 const info=installmentInfo(tx,data);
 if(info?.purchaseKey.startsWith('purchase:')){const day=info.purchaseKey.split('|')[0]!,candidates=data.records.filter(other=>other.itemId===tx.itemId&&other.accountId===tx.accountId&&installmentPurchaseDatesCompatible(other,tx)).map(other=>installmentInfo(other,data)).filter((other):other is NonNullable<typeof info>=>!!other&&other.purchaseKey.startsWith('purchase:')&&other.count===info.count&&other.cycle===info.cycle&&installmentAmountsCompatible(other,info)&&(other.merchant===info.merchant||Math.min(other.merchant.length,info.merchant.length)>=12&&(other.merchant.startsWith(info.merchant)||info.merchant.startsWith(other.merchant))));const merchant=candidates.map(c=>c.merchant).sort((a,b)=>a.length-b.length||a.localeCompare(b))[0]||info.merchant;const canonicalDay=[day,...candidates.map(c=>c.purchaseKey.split('|')[0]!)].sort()[0]!;info.purchaseKey=canonicalDay+'|'+merchant;}
 const value=info?JSON.stringify([tx.itemId,tx.accountId,info.purchaseKey,info.count,info.cycle]):null;
 cache.set(tx,{value});return value;
}
export function purchaseFamily(data:LocalBankData,anchor:BankRecord){
 const context=data;
 const identity=purchaseIdentity(anchor,context),info=installmentInfo(anchor,context);
 if(!identity||!info)throw Error('Selecione uma compra parcelada identificada pela instituição.');
 const members=data.records.filter(tx=>purchaseIdentity(tx,context)===identity&&installmentAmountsCompatible(installmentInfo(tx,context)!,info));
 const numbers=members.map(tx=>installmentInfo(tx,context)!.n);
 if(new Set(numbers).size!==numbers.length)throw Error('Há compras indistinguíveis nesta série. Confira as parcelas antes de alterar.');
 return {identity,members,info};
}
export function validatePurchaseLabel(label:string){
 if(typeof label!=='string'||label.trim().length>100||/[\u0000-\u001f]/.test(label))throw Error('Use um nome de compra com até 100 caracteres.');
 return label.trim();
}
function protectedFinancial(note:LocalAnnotation){return !!(note.event&&note.event!=='Nenhum evento'||note.controlId||note.links&&Object.keys(note.links).length||note.compensations?.length||note.receiptRemainder||(note as any).receiptRounding);}
/** Explicit series decisions are independent from automatic merchant rules. Bank rows stay intact. */
export function purchaseSeriesChanges(data:LocalBankData,controls:Control[],series:PurchaseSeries,explicit=false){
 if(series.scope!==data.scope)throw Error('A compra pertence a outra conexão.');
 const anchor=data.records.find(tx=>tx.id===series.sourceTransactionId);
 if(!anchor)throw Error('Compra de referência não encontrada.');
 const family=purchaseFamily(data,anchor);
 if(Math.abs(family.info.amount-series.anchorAmountCents)>5)throw Error('A identificação da compra mudou. Confira antes de aplicar.');
 const owner=series.ownerId?controls.find(c=>c.type==='people'&&c.id===series.ownerId&&!c.disabled&&c.active!==false):undefined;
 if(series.ownerId&&!owner)throw Error('A pessoa desta compra não está ativa.');
 const changes:{id:string;annotation:LocalAnnotation}[]=[],conflicts:{id:string;reason:string}[]=[];
 for(const tx of family.members){
  const previous=data.annotations[tx.id]||{},next:LocalAnnotation={...previous,purchaseLabel:validatePurchaseLabel(series.label),purchaseSeriesId:series.id};
  if((previous as any)._deletedAt){conflicts.push({id:tx.id,reason:'A classificação foi excluída; confira antes de reaplicar a compra.'});continue;}
  if(series.ownerId!==undefined){
   const shares=previous.shares||[],priorManaged=previous.seriesOwnerId!==undefined;
   const sameOwner=owner?shares.length===1&&shares[0]!.person===owner.name&&Math.round(Number(shares[0]!.amount.replace(/\./g,'').replace(',','.'))*100)===Math.abs(tx.amountCents):!shares.length;
   const settled=controls.some(c=>c.type==='reconciliations'&&(c.bankRecordId===tx.id||c.sourceBankRecordId===tx.id||controls.some(o=>o.id===c.controlId&&o.transactionId===tx.id)));
   const manuallyChanged=priorManaged&&(previous.seriesOwnerId!==series.ownerId||previous.personId!==(series.ownerId||undefined)||!sameOwner);
   const reason=protectedFinancial(previous)||settled&&!sameOwner?'A parcela tem vínculos financeiros; desfaça-os antes de mudar o dono.':!explicit&&(manuallyChanged||!priorManaged&&shares.length>0&&!sameOwner)?'A parcela possui uma divisão manual diferente.':null;
   if(reason){conflicts.push({id:tx.id,reason});continue;}
   if(owner){
    const month=installmentInfo(tx,data)!.month,day=Number(series.dueDay),fallback=Number.isInteger(day)&&day>=1&&day<=31?month+'-'+String(Math.min(day,new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate())).padStart(2,'0'):undefined;
    const due=installmentDueDate(tx,month,data,controls)||fallback;
    if(!due){conflicts.push({id:tx.id,reason:'Vencimento da parcela indisponível ou ambíguo.'});continue;}
    next.personId=owner.id;next.personName=owner.name;next.nature='Despesa';
    next.shares=[{id:sameOwner?shares[0]!.id:'series-full:'+tx.id,person:owner.name,amount:(Math.abs(tx.amountCents)/100).toFixed(2).replace('.',','),dueDate:installmentDueDate(tx,month,data,controls,true)||(sameOwner?shares[0]!.dueDate:due)}];
   }else{delete next.personId;delete next.personName;next.shares=[];}
   next.seriesOwnerId=series.ownerId;next.sourceAmountCentsAtEdit=tx.amountCents;
  }
  if(series.classification){next.nature=series.classification.nature;next.categoryId=series.classification.categoryId;}
  if(JSON.stringify(previous)!==JSON.stringify(next))changes.push({id:tx.id,annotation:next});
 }
 return {changes,conflicts};
}
export function purchaseDisplayName(tx:BankRecord,annotation?:LocalAnnotation){return annotation?.purchaseLabel?.trim()||tx.name;}
export function installmentPurchases(data:LocalBankData,controls:Control[]=[]){
 const context=data;
 const buckets=new Map<string,BankRecord[]>();
 for(const tx of [...data.records].sort((a,b)=>Math.abs(a.amountCents)-Math.abs(b.amountCents)||a.id.localeCompare(b.id))){const base=purchaseIdentity(tx,context);if(!base)continue;const keys=[...buckets.keys()].filter(k=>k.startsWith(base+'|amount:')),key=keys.find(k=>buckets.get(k)!.every(member=>installmentAmountsCompatible(installmentInfo(member,context)!,installmentInfo(tx,context)!)))||base+'|amount:'+Math.abs(tx.amountCents);buckets.set(key,[...(buckets.get(key)||[]),tx]);}
 return [...buckets].map(([identity,members])=>{
  members.sort((a,b)=>installmentInfo(a,context)!.n-installmentInfo(b,context)!.n||a.id.localeCompare(b.id));
  const anchor=members[0]!,info=installmentInfo(anchor,context)!,numbers=members.map(tx=>installmentInfo(tx,context)!.n),ambiguous=new Set(numbers).size!==numbers.length;
  const decisions=controls.filter(c=>c.type==='purchase-series'&&c.scope===data.scope&&members.some(m=>m.id===c.sourceTransactionId)),labels=[...new Set(decisions.map(c=>c.label).filter(Boolean))];
  const series=decisions.length===1?decisions[0]:undefined,unique=new Set(numbers).size;
  return {identity,itemId:anchor.itemId,accountId:anchor.accountId,name:labels.length===1?String(labels[0]):(data.annotations[anchor.id]?.purchaseLabel||anchor.name.replace(/(?:\s*PARC(?:ELA)?\s*)?\d{1,2}\s*\/\s*\d{1,2}\s*$/i,'').trim()),originalName:anchor.name,totalInstallments:info.count,importedInstallments:unique,missingInstallments:Math.max(0,info.count-unique),importedTotalCents:members.reduce((n,tx)=>n+Math.abs(tx.amountCents),0),installmentMinCents:Math.min(...members.map(m=>Math.abs(m.amountCents))),installmentMaxCents:Math.max(...members.map(m=>Math.abs(m.amountCents))),ambiguous,seriesId:series?.id,installments:members.map(tx=>({record:tx,number:installmentInfo(tx,context)!.n,invoiceMonth:installmentInfo(tx,context)!.month,annotation:data.annotations[tx.id]}))};
 });
}

export function purchaseParticipants(data:LocalBankData,records:BankRecord[],people:Control[]){
 const participants=new Map<string,{id:string;name:string;self:boolean}>();
 for(const tx of records){const note=data.annotations[tx.id],shares=note?.shares||[],assigned=shares.reduce((sum,s)=>sum+Math.round(Number(s.amount.replace(/\./g,'').replace(',','.'))*100||0),0);
  if(Math.abs(tx.amountCents)-assigned>0)participants.set('self',{id:'self',name:'Você',self:true});
  const names=shares.length?shares.map(s=>s.person):note?.personName?[note.personName]:[];
  for(const name of names){const id=people.find(p=>p.name===name)?.id||note?.personId||name;participants.set(id,{id,name,self:false});}
 }
 return [...participants.values()].sort((a,b)=>Number(b.self)-Number(a.self)||a.name.localeCompare(b.name));
}
