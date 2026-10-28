import type {LocalBankData} from './pluggyModel';
import type {Control} from './localControls';
export function recurringMonth(data:LocalBankData,controls:Control[],month:string){
 return controls.filter(c=>c.type==='recurrences'&&!c.disabled&&c.nature!=='Entrada prevista'&&(!c.startDate||String(c.startDate).slice(0,7)<=month)&&(!c.endDate||String(c.endDate).slice(0,7)>=month)).map(c=>{
 const day=Math.min(Math.max(1,Number(c.day)||1),new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()),date=month+'-'+String(day).padStart(2,'0'),links=(c.linkedTransactions||{}) as Record<string,string>,record=data.records.find(r=>r.id===links[month]&&r.kind==='transaction'&&r.status==='POSTED'&&r.amountCents<0&&(!c.accountId||r.accountId===c.accountId));
 return {...c,day:Number(c.day)||1,date,linkedRecord:record,confirmed:!!record,value:record?Math.abs(record.amountCents):Number(c.amountCents||0),variable:!!c.variable};
 });
}
