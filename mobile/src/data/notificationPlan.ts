import type {LocalBankData} from './pluggyModel';
import type {Control,Reconciliation} from './localControls';
import {loanLedger} from './localControls';
import type {AppPreferences} from './appPreferences';
export const notificationPrefix=(scope:string)=>{let n=2166136261;for(const c of scope)n=Math.imul(n^c.charCodeAt(0),16777619);return 'financeiro-'+(n>>>0).toString(16)+'-';};
export function notificationPlan(data:LocalBankData,controls:Control[],preferences:AppPreferences,now=new Date()){
 if(!preferences.notifications.enabled)return [];
 const receipts=controls.filter(c=>c.type==='reconciliations') as unknown as Reconciliation[],prefix=notificationPrefix(data.scope),events:{id:string;title:string;body:string;at:Date;page:string;name?:string}[]=[];
 const add=(id:string,title:string,body:string,day:string,page:string,name?:string)=>{const at=new Date(day+'T09:00:00-03:00');if(Number.isFinite(at.getTime())&&at>now&&at.getTime()-now.getTime()<60*86400000)events.push({id:prefix+id,title,body,at,page,name});};
 if(preferences.notifications.types.includes('invoice-due'))for(const bill of data.records.filter(r=>r.kind==='bill'&&!['DELETED','CANCELLED'].includes(r.status))){
  const paid=receipts.filter(r=>r.direction==='bill-payment'&&r.controlId===bill.id).reduce((n,r)=>n+r.amountCents,0);
  const settings=controls.find(c=>c.type==='card-settings'&&c.accountId===bill.accountId&&(!c.itemId||c.itemId===bill.itemId)),day=String(settings?.['dueDate:'+bill.date.slice(0,7)]||bill.date);
  if(paid<bill.amountCents)add('bill-'+bill.id,'Fatura vence hoje','Confira sua fatura no Financeiro.',day,'cards',bill.accountId);
 }
 if(preferences.notifications.types.includes('loan-due'))for(const loan of controls.filter(c=>c.type==='loans'))for(const part of loanLedger(loan,receipts))if(part.pending>0)add('loan-'+part.id,'Parcela de empréstimo vence hoje',loan.person?'Confira a parcela de '+loan.person+'.':'Confira as parcelas a receber.',part.dueDate,'loan',loan.id);
 return events.sort((a,b)=>a.at.getTime()-b.at.getTime()).slice(0,100);
}
