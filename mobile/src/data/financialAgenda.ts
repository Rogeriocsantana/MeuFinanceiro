import {cardInvoice,cardBillingDates,cardBillPaymentSummary} from './cardInvoice';
import {deriveObligations,loanLedger,controlBalance,type Control,type Reconciliation} from './localControls';
import {recurringMonth} from './recurringInsights';
import type {LocalBankData} from './pluggyModel';
export type AgendaItem={id:string;name:string;date:string;amount:number;direction:'pay'|'receive';resolved:boolean;estimated:boolean;included:boolean;route:string;target?:string;detail:string};
/** Read-only view of the same obligations and receipts used by cards and people. */
export function financialAgenda(data:LocalBankData,stored:Control[],month:string){
 const controls=deriveObligations(data,stored),receipts=stored.filter(c=>c.type==='reconciliations') as unknown as Reconciliation[],rows:AgendaItem[]=[];
 for(const card of data.records.filter(r=>r.kind==='card'&&r.status!=='DELETED')){
  const invoice=cardInvoice(data,card,month,controls),date=cardBillingDates(data,card,month,controls).due;
  if(invoice.totalCents===null||!date)continue;
  const pending=invoice.bill?invoice.bill.status==='PAID'?0:cardBillPaymentSummary(data,invoice.bill,receipts).pendingCents:Math.max(0,invoice.totalCents);
  rows.push({id:'bill:'+card.id+':'+month,name:'Fatura · '+card.name,date,amount:pending||Math.max(0,invoice.totalCents),direction:'pay',resolved:pending===0,estimated:!invoice.bill,included:true,route:'invoice',target:card.accountId,detail:invoice.bill?'Fatura informada pelo banco':'Acumulado previsto · sujeito à atualização do banco'});
 }
 for(const control of controls.filter(c=>c.type==='loans'))for(const part of loanLedger(control,receipts)){
  if(part.dueDate.slice(0,7)!==month)continue;
  rows.push({id:'loan:'+control.id+':'+part.id,name:control.person||control.name,date:part.dueDate,amount:part.pending||part.amountCents,direction:'receive',resolved:part.pending===0,estimated:false,included:true,route:'loan',target:control.id,detail:control.name+' · parcela '+part.index});
 }
 for(const control of controls.filter(c=>c.type==='card-shares'&&String(c.dueDate||'').slice(0,7)===month)){
  const balance=controlBalance(control,receipts);rows.push({id:'purchase:'+control.id,name:control.person||control.name,date:String(control.dueDate),amount:balance.pendingCents||balance.totalCents,direction:'receive',resolved:balance.pendingCents===0,estimated:false,included:true,route:'person',target:control.person,detail:control.name+' · compra a receber'});
 }
 for(const recurrence of recurringMonth(data,controls,month)){
  const card=data.records.some(r=>r.kind==='card'&&r.accountId===recurrence.accountId),confirmed=recurrence.confirmed;
  rows.push({id:'recurring:'+recurrence.id,name:recurrence.name,date:recurrence.date,amount:recurrence.value,direction:'pay',resolved:confirmed,estimated:!confirmed,included:!card,route:'recurring-overview',detail:card?'No cartão · já contemplada na fatura':recurrence.variable?'Conta variável · valor de referência':'Cobrança recorrente em conta'});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
 return {rows,pay:rows.filter(r=>r.included&&!r.resolved&&r.direction==='pay').reduce((n,r)=>n+r.amount,0),receive:rows.filter(r=>!r.resolved&&r.direction==='receive').reduce((n,r)=>n+r.amount,0)};
}
