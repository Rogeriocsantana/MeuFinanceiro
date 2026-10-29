import {withInstallmentForecast} from './installmentForecast';
import {cardInvoiceMonth,isCardBillPayment} from './cardInvoice';
import {transactionDisplayDate} from './transactionDates';
import type {BankRecord,LocalBankData} from './pluggyModel';
import type {Control} from './localControls';
import {purchaseDisplayName} from './purchaseSeries';

export type InvoiceSelection={itemId:string;accountId:string;month:string;person?:string;sharedOnly?:boolean;includePending?:boolean};
/** Signed totals retain refunds. Person filtering changes the selected portion, never the bank value. */
export function invoiceDetails(data:LocalBankData,selection:InvoiceSelection,controls:Control[]=[]){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(selection.month))throw Error('Mês da fatura inválido.');
 data=withInstallmentForecast(data,[selection.month],controls);
 const same=(r:BankRecord)=>r.itemId===selection.itemId&&r.accountId===selection.accountId;
 const bills=data.records.filter(r=>r.kind==='bill'&&same(r)&&!['DELETED','CANCELLED'].includes(r.status));
 const unresolved:string[]=[];
 const rows=data.records.filter(tx=>tx.kind==='transaction'&&tx.metadata.card&&!isCardBillPayment(tx)&&same(tx)&&(tx.status==='POSTED'||selection.includePending&&tx.status==='PENDING')).flatMap(tx=>{
  const exact=tx.metadata.billId?bills.filter(b=>b.id===tx.metadata.billId||b.metadata.sourceId===tx.metadata.billId):[];
  if(exact.length>1){unresolved.push(tx.id);return [];}
  const month=cardInvoiceMonth(data,tx,controls);
  if(!month){unresolved.push(tx.id);return [];}
  if(month!==selection.month)return [];
  const note=data.annotations[tx.id],totalCents=-tx.amountCents;
  const shares=(note?.shares||[]).map(share=>{
   const people=controls.filter(c=>c.type==='people'&&c.name===share.person);
   const personId=(share as any).personId||(note?.personName===share.person?note.personId:undefined)||(people.length===1?people[0]!.id:undefined);
   const amountCents=Math.round(Number(share.amount.replace(/\./g,'').replace(',','.'))*100);
   if(!Number.isSafeInteger(amountCents)||amountCents<0)throw Error('Participação inválida na fatura.');
   return {id:share.id,personId,personName:share.person,amountCents};
  });
  const othersCents=shares.reduce((n,s)=>n+s.amountCents,0),ownCents=totalCents-othersCents;
  if(totalCents>=0&&othersCents>totalCents||totalCents<0&&othersCents)throw Error('Participações maiores que a compra na fatura.');
  const shared=shares.length>1||shares.length>0&&ownCents>0;
  if(selection.sharedOnly&&!shared)return [];
  const selectedCents=!selection.person||selection.person==='all'?totalCents:selection.person==='self'?ownCents:shares.filter(s=>s.personId===selection.person).reduce((n,s)=>n+s.amountCents,0);
  if(selection.person&&selection.person!=='all'&&!selectedCents)return [];
  const displayed=transactionDisplayDate(tx);
  return [{id:tx.id,name:purchaseDisplayName(tx,note),originalName:tx.name,date:displayed.date,dateLabel:displayed.label,totalCents,ownCents,othersCents,selectedCents,shared,shares,pending:tx.status==='PENDING',record:tx}];
 }).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 const days=[...new Set(rows.map(r=>r.date))].map(date=>({date,rows:rows.filter(r=>r.date===date),totalCents:rows.filter(r=>r.date===date).reduce((n,r)=>n+r.selectedCents,0)}));
 const currentBills=bills.filter(b=>b.date.slice(0,7)===selection.month);
 return {rows,days,selectedTotalCents:rows.reduce((n,r)=>n+r.selectedCents,0),ownCents:rows.reduce((n,r)=>n+r.ownCents,0),othersCents:rows.reduce((n,r)=>n+r.othersCents,0),bankBillTotalCents:currentBills.length===1?currentBills[0]!.amountCents:null,unresolvedTransactionIds:unresolved};
}
