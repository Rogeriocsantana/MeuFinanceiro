import {installmentForecastRows} from './installmentForecast';
import type {BankRecord,LocalBankData} from './pluggyModel';
import type {Control,Reconciliation} from './localControls';

/** Settlements pay a bill; they are not refunds or purchases on the next bill. */
export function isCardBillPayment(tx:BankRecord){
 if(!tx.metadata.card||tx.amountCents<=0)return false;
 const operation=String(tx.metadata.operationType||'').toUpperCase();
 if(/ESTORNO|REFUND/.test(operation))return false;
 if(/PAGAMENTO_FATURA|CREDIT_CARD_PAYMENT/.test(operation))return true;
 const name=tx.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
 return /^PAGAMENTO\s+(?:DEBITO AUTOMATICO|(?:DE\s+)?FATURA|RECEBIDO|(?:DE\s+)?CARTAO)\b/.test(name);
}
export function cardInvoiceMonth(data:LocalBankData,tx:BankRecord,controls:Control[]=[]){
 if(!tx.metadata.card)return tx.date.slice(0,7);
 const bill=tx.metadata.billId?data.records.find(b=>b.kind==='bill'&&b.itemId===tx.itemId&&b.accountId===tx.accountId&&!['DELETED','CANCELLED'].includes(b.status)&&(b.id===tx.metadata.billId||b.metadata.sourceId===tx.metadata.billId)):undefined;
 if(bill)return bill.date.slice(0,7);
 if(tx.invoiceMonth)return tx.invoiceMonth;
 const setting=controls.find(c=>c.type==='card-settings'&&c.accountId===tx.accountId&&(!c.itemId||c.itemId===tx.itemId));
 const historical=data.records.filter(b=>b.kind==='bill'&&b.itemId===tx.itemId&&b.accountId===tx.accountId&&!['DELETED','CANCELLED'].includes(b.status)&&/^\d{4}-\d{2}-\d{2}/.test(b.metadata.closingDate||'')).sort((a,b)=>b.date.localeCompare(a.date));
 const day=Number(setting?.closingDay||historical[0]?.metadata.closingDate?.slice(8,10)),date=new Date((tx.metadata.rawDate?.slice(0,10)||tx.date)+'T12:00:00');
 if(!day)return '';
 if(day>0&&date.getDate()>day)date.setMonth(date.getMonth()+1,1);
 return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
}
export function cardInvoice(data:LocalBankData,card:BankRecord,month:string,controls:Control[]=[]){
 const same=(r:BankRecord)=>r.itemId===card.itemId&&r.accountId===card.accountId;
 const bill=data.records.find(r=>r.kind==='bill'&&same(r)&&!['DELETED','CANCELLED'].includes(r.status)&&r.date.slice(0,7)===month);
 const candidates=[...data.records,...installmentForecastRows(data,month).filter(p=>!data.records.some(r=>r.id===p.id))],rows=candidates.filter(r=>r.kind==='transaction'&&r.metadata.card&&same(r)&&['POSTED','PENDING'].includes(r.status)&&!isCardBillPayment(r)&&cardInvoiceMonth(data,r,controls)===month);
 const estimatedTotalCents=rows.length?rows.reduce((n,r)=>n-r.amountCents,0):null;
 return {bill,rows,estimatedTotalCents,projectedCents:rows.filter(r=>r.metadata.installmentProjection).reduce((sum,r)=>sum-r.amountCents,0),totalCents:bill?.amountCents??estimatedTotalCents};
}

/** Known cycle dates projected only when the official bill has not arrived. */
export function cardBillingDates(data:LocalBankData,card:BankRecord,month:string,controls:Control[]=[]){
 const bills=data.records.filter(b=>b.kind==='bill'&&b.itemId===card.itemId&&b.accountId===card.accountId&&!['DELETED','CANCELLED'].includes(b.status)),exact=bills.find(b=>b.date.slice(0,7)===month),setting=controls.find(c=>c.type==='card-settings'&&c.accountId===card.accountId&&(!c.itemId||c.itemId===card.itemId));
 const previous=bills.filter(b=>b.date.slice(0,7)<=month).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const project=(day:number,offset=0)=>{if(!Number.isInteger(day)||day<1||day>31)return '';const d=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1,12);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate())).padStart(2,'0');};
 const knownClosing=String(previous?.metadata.closingDate||card.metadata.closingDate||'').slice(0,10),knownDue=String(previous?.date||card.metadata.dueDate||'').slice(0,10),offset=knownClosing&&knownDue?(Number(knownClosing.slice(0,4))*12+Number(knownClosing.slice(5,7)))-(Number(knownDue.slice(0,4))*12+Number(knownDue.slice(5,7))):0;
 return {closing:String(setting?.['closingDate:'+month]||exact?.metadata.closingDate||project(Number(setting?.closingDay||knownClosing.slice(8,10)),offset)).slice(0,10),due:String(setting?.['dueDate:'+month]||exact?.date||project(Number(setting?.dueDay||knownDue.slice(8,10)))).slice(0,10),estimated:!exact};
}

/** A card-side receipt must explicitly reference this bill; amount/date alone never identify a payment. */
export function cardBillPaymentSummary(data:LocalBankData,bill:BankRecord,receipts:Reconciliation[]=[],asOf=new Date().toISOString().slice(0,10)){
 const official=(Array.isArray(bill.metadata.payments)?bill.metadata.payments:[]).filter((p:any)=>Number.isSafeInteger(p.amountCents)&&p.amountCents>0&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&p.date<=asOf),uniqueOfficial=new Map(official.map((p:any)=>[p.id||JSON.stringify([p.date,p.amountCents]),p]));
 const officialPaid=[...uniqueOfficial.values()].reduce((n:number,p:any)=>n+p.amountCents,0);
 const cardPaid=data.records.filter(r=>r.itemId===bill.itemId&&r.accountId===bill.accountId&&r.status==='POSTED'&&r.date<=asOf&&isCardBillPayment(r)&&!!r.metadata.billId&&(r.metadata.billId===bill.id||r.metadata.billId===bill.metadata.sourceId)).reduce((n,r)=>n+r.amountCents,0);
 const manualPaid=receipts.filter(r=>r.direction==='bill-payment'&&r.controlId===bill.id&&r.date<=asOf).reduce((n,r)=>n+r.amountCents,0);
 const paidCents=Math.max(officialPaid,cardPaid,manualPaid);return {paidCents,pendingCents:Math.max(0,bill.amountCents-paidCents)};
}
