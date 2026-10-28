import type {BankRecord,LocalAnnotation,LocalBankData} from './pluggyModel';
import type {Control} from './localControls';

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const monthIndex=(value:string)=>{const match=value.match(/^(\d{4})-(0[1-9]|1[0-2])$/);return match?Number(match[1])*12+Number(match[2]):null;};
function billsFor(tx:BankRecord,data:LocalBankData){return data.records.filter(b=>b.kind==='bill'&&b.accountId===tx.accountId&&b.itemId===tx.itemId&&!['CANCELLED','DELETED'].includes(b.status));}
function invoiceMonth(tx:BankRecord,data:LocalBankData){const exact=billsFor(tx,data).filter(b=>tx.metadata.billId&&(b.metadata.sourceId===tx.metadata.billId||b.id===tx.metadata.billId));return exact.length===1?exact[0]!.date.slice(0,7):tx.invoiceMonth||'';}
export function installmentPurchaseDay(tx:BankRecord){const raw=tx.metadata.purchaseDate||tx.metadata.transactionDateTime;return typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)&&Number.isFinite(Date.parse(raw))?new Date(raw).toISOString().slice(0,10):'';}
/** A provider shift is accepted only with matching original posting day and at most three hours. */
export function installmentPurchaseDatesCompatible(a:BankRecord,b:BankRecord){
 const left=installmentPurchaseDay(a),right=installmentPurchaseDay(b);if(!left||!right||left===right)return true;
 const postedA=String(a.metadata.billPostDate||'').slice(0,10),postedB=String(b.metadata.billPostDate||'').slice(0,10);
 return !!postedA&&postedA===postedB&&Math.abs(Date.parse(a.metadata.purchaseDate||a.metadata.transactionDateTime)-Date.parse(b.metadata.purchaseDate||b.metadata.transactionDateTime))<=10800000;
}
export function installmentInfo(tx:BankRecord,data:LocalBankData){
 if(tx.kind!=='transaction'||!tx.metadata?.card||typeof tx.name!=='string')return null;
 const n=Number(tx.metadata.installmentNumber),count=Number(tx.metadata.totalInstallments),month=invoiceMonth(tx,data),index=monthIndex(month),merchant=normalize(tx.name).replace(/(?:\s*PARC(?:ELA)?\s*)?\d{1,2}\s*\/\s*\d{1,2}\s*$/,'').trim();
 if(tx.kind!=='transaction'||!tx.metadata.card||tx.amountCents>=0||['CANCELLED','DELETED'].includes(tx.status)||!Number.isInteger(n)||!Number.isInteger(count)||n<1||count<2||n>count||index===null||!merchant)return null;
 const rawPurchase=tx.metadata.purchaseDate||tx.metadata.transactionDateTime,precise=typeof rawPurchase==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawPurchase)&&Number.isFinite(Date.parse(rawPurchase))?new Date(rawPurchase).toISOString():null;
 return {n,count,month,merchant,purchaseKey:precise?'purchase:'+installmentPurchaseDay(tx)+'|'+merchant:merchant,cycle:index-n,amount:Math.abs(tx.amountCents)};
}
/** The first installment may carry the cent remainder of all the other installments. */
export function installmentAmountsCompatible(a:{n:number;count:number;amount:number},b:{n:number;count:number;amount:number}){
 if(a.count!==b.count||!Number.isSafeInteger(a.amount)||!Number.isSafeInteger(b.amount))return false;
 const difference=Math.abs(a.amount-b.amount);
 return difference<=5||((a.n===1)!==(b.n===1))&&difference<=a.count-1;
}
export function installmentDueDate(tx:BankRecord,month:string,data:LocalBankData,controls:Control[],officialOnly=false){
 const bills=billsFor(tx,data),settings=controls.filter(c=>c.type==='card-settings'&&c.accountId===tx.accountId&&(!c.itemId||c.itemId===tx.itemId));
 const valid=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const overrides=[...new Set(settings.map(c=>c['dueDate:'+month]).filter(value=>valid(value)&&value.slice(0,7)===month))];
 if(overrides.length===1)return overrides[0] as string;
 if(overrides.length>1)return undefined;
 const exact=tx.metadata.billId?bills.filter(b=>b.metadata.sourceId===tx.metadata.billId||b.id===tx.metadata.billId):[];
 if(exact.length===1&&valid(exact[0]!.date)&&exact[0]!.date.slice(0,7)===month)return exact[0]!.date;
 if(exact.length>1)return undefined;
 const monthly=bills.filter(b=>b.date.slice(0,7)===month);
 if(monthly.length===1&&valid(monthly[0]!.date))return monthly[0]!.date;
 if(monthly.length>1)return undefined;
 const card=data.records.find(r=>r.kind==='card'&&r.accountId===tx.accountId&&r.itemId===tx.itemId),cardDue=card?.metadata.dueDate;
 if(valid(cardDue)&&cardDue.slice(0,7)===month)return cardDue;
 if(officialOnly)return undefined;
 const configuredDay=Number(settings.length===1?settings[0]!.dueDay:0),target=monthIndex(month);
 const available=bills.filter(b=>valid(b.date)&&monthIndex(b.date.slice(0,7))!==null).sort((a,b)=>Math.abs(monthIndex(a.date.slice(0,7))!-target!)-Math.abs(monthIndex(b.date.slice(0,7))!-target!));
 const nearest=available[0],distance=nearest&&target!==null?Math.abs(monthIndex(nearest.date.slice(0,7))!-target):null,nearestDays=new Set(available.filter(b=>distance!==null&&Math.abs(monthIndex(b.date.slice(0,7))!-target!)===distance).map(b=>Number(b.date.slice(8,10))));
 const day=configuredDay||(nearestDays.size===1?Number(nearest!.date.slice(8,10)):0);
 if(target===null||!Number.isInteger(day)||day<1||day>31)return undefined;
 const [year,m]=month.split('-').map(Number),last=new Date(Date.UTC(year!,m!,0)).getUTCDate();return month+'-'+String(Math.min(day,last)).padStart(2,'0');
}
/** Shares follow their own month's bill; keep ids, amounts, people and financial links intact. */
export function installmentDueDateChanges(data:LocalBankData,controls:Control[]){
 const changes:{id:string;annotation:LocalAnnotation}[]=[];
 for(const tx of data.records){
  const info=installmentInfo(tx,data),note=data.annotations[tx.id];
  if(!info||!note?.shares?.length||(note as any)._deletedAt)continue;
  const due=installmentDueDate(tx,info.month,data,controls,true);
  if(!due||note.shares.every(share=>share.dueDate===due))continue;
  changes.push({id:tx.id,annotation:{...note,shares:note.shares.map(share=>({...share,dueDate:due}))}});
 }
 return changes;
}

function shareCents(amount:string){return Math.round(Number(amount.replace(/\./g,'').replace(',','.'))*100);}
function financial(annotation:LocalAnnotation){return !!(annotation.event&&annotation.event!=='Nenhum evento'||annotation.controlId||annotation.links&&Object.keys(annotation.links).length||annotation.compensations?.length||annotation.receiptRemainder||(annotation as any).receiptRounding);}

/** Recognize imported installments only; never generate bank transactions or overwrite human edits. */
export function installmentContinuityChanges(data:LocalBankData,controls:Control[]){
 const changes:{id:string;annotation:LocalAnnotation}[]=[],conflicts:{id:string;reason:string}[]=[],records=data.records.map(tx=>({tx,info:installmentInfo(tx,data)})).filter((entry):entry is {tx:BankRecord;info:NonNullable<ReturnType<typeof installmentInfo>>}=>!!entry.info);
 const people=controls.filter(c=>c.type==='people'&&!c.disabled&&c.active!==false);
 for(const current of records){
  const {tx,info:target}=current,existing=data.annotations[tx.id];
  // Even a category, note, or explicit empty participation list is an existing human decision.
  if(existing&&Object.keys(existing).length)continue;
  const family=records.filter(candidate=>candidate.tx.accountId===tx.accountId&&candidate.tx.itemId===tx.itemId&&candidate.info.purchaseKey===target.purchaseKey&&candidate.info.count===target.count&&candidate.info.cycle===target.cycle&&installmentAmountsCompatible(candidate.info,target));
  const anchors=family.filter(candidate=>candidate.info.n<target.n&&(data.annotations[candidate.tx.id]?.categoryId||data.annotations[candidate.tx.id]?.shares?.length)).map(candidate=>{
   const note=data.annotations[candidate.tx.id]!,shares=note.shares||[],share=shares.length===1&&shareCents(shares[0]!.amount)===candidate.info.amount?shares[0]:undefined;
   const matches=share?people.filter(person=>person.name===share.person&&(!note.personId||note.personId===person.id||note.personId===person.name)):[];
   return {...candidate,note,person:share&&matches.length===1&&!financial(note)?matches[0]:undefined};
  });
  if(!anchors.some(anchor=>anchor.person))continue;
  if(new Set(family.map(candidate=>candidate.info.n)).size!==family.length){conflicts.push({id:tx.id,reason:'Mais de uma compra corresponde à mesma parcela.'});continue;}
  if(anchors.some(anchor=>!anchor.person)||new Set(anchors.map(anchor=>anchor.person!.id+'|'+(anchor.note.categoryId||''))).size!==1){conflicts.push({id:tx.id,reason:'Histórico de parcelas com pessoas, categorias ou participações divergentes.'});continue;}
  const anchor=anchors.sort((a,b)=>b.info.n-a.info.n)[0]!,due=installmentDueDate(tx,target.month,data,controls);
  if(!due){conflicts.push({id:tx.id,reason:'Vencimento da fatura indisponível ou ambíguo.'});continue;}
  const annotation:LocalAnnotation&{installmentContinuity:{sourceTransactionId:string;sourceInstallment:number;installment:number;totalInstallments:number}}={nature:'Despesa',categoryId:anchor.note.categoryId||'',personId:anchor.person!.id,personName:anchor.person!.name,shares:[{id:'installment-full:'+tx.id,person:anchor.person!.name,amount:(target.amount/100).toFixed(2).replace('.',','),dueDate:due}],sourceAmountCentsAtEdit:tx.amountCents,installmentContinuity:{sourceTransactionId:anchor.tx.id,sourceInstallment:anchor.info.n,installment:target.n,totalInstallments:target.count}};
  changes.push({id:tx.id,annotation});
 }
 return {changes,conflicts};
}
