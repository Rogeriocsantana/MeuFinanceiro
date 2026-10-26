import type {BankRecord,LocalBankData} from './pluggyModel';
import {installmentInfo,installmentPurchaseDatesCompatible} from './installmentContinuity';
const index=(month:string)=>Number(month.slice(0,4))*12+Number(month.slice(5,7));
const compatible=(a:string,b:string)=>a===b||Math.min(a.length,b.length)>=12&&(a.startsWith(b)||b.startsWith(a));
/** Read-only estimates. Never persist these rows or count them as bank confirmations. */
export function installmentForecastRows(data:LocalBankData,month:string):BankRecord[]{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];
 const context={...data,records:data.records.filter(r=>r.kind==='bill')},entries=data.records.filter(r=>!r.metadata.installmentProjection).map(tx=>({tx,info:installmentInfo(tx,context)})).filter(e=>e.info!==null),out:BankRecord[]=[];
 for(const entry of entries.sort((a,b)=>b.info!.month.localeCompare(a.info!.month)||a.tx.id.localeCompare(b.tx.id))){
  const {tx}=entry,info=entry.info!,distance=index(month)-index(info.month),number=info.n+distance;if(distance<=0||number>info.count)continue;
  if(context.records.some(b=>b.itemId===tx.itemId&&b.accountId===tx.accountId&&b.date.slice(0,7)===month&&!['DELETED','CANCELLED'].includes(b.status)))continue;
  const family=entries.filter(e=>e.tx.itemId===tx.itemId&&e.tx.accountId===tx.accountId&&e.info!.count===info.count&&e.info!.cycle===info.cycle&&Math.abs(e.info!.amount-info.amount)<=5&&compatible(e.info!.merchant,info.merchant)&&installmentPurchaseDatesCompatible(e.tx,tx));
  if(family.some(e=>e.info!.month===month))continue;
  if(family.some(e=>e.info!.month>info.month&&e.info!.month<month))continue;
  if(family.filter(e=>e.info!.month===info.month).length>1)continue;
  if(out.some(r=>r.itemId===tx.itemId&&r.accountId===tx.accountId&&r.metadata.totalInstallments===info.count&&r.metadata.installmentNumber===number&&Math.abs(r.amountCents-tx.amountCents)<=5&&compatible(String(r.metadata.forecastMerchant),info.merchant)))continue;
  out.push({...tx,id:tx.id+':forecast:'+number,name:tx.name.replace(/\d{1,2}\s*\/\s*\d{1,2}\s*$/,number+'/'+info.count),date:month+'-01',invoiceMonth:month,status:'PENDING',metadata:{...tx.metadata,billId:'',rawDate:null,purchaseDate:null,billPostDate:null,installmentNumber:number,installmentProjection:true,projectionSourceId:tx.id,forecastMerchant:info.merchant}});
 }
 return out;
}
export function withInstallmentForecast(data:LocalBankData,months:string[]):LocalBankData{
 const projections=[...new Set(months)].flatMap(month=>installmentForecastRows(data,month)).filter(p=>!data.records.some(r=>r.id===p.id)),annotations={...data.annotations};
 for(const p of projections){const note=data.annotations[p.metadata.projectionSourceId];if(note)annotations[p.id]={...note,shares:note.shares?.map(s=>({...s,dueDate:p.invoiceMonth+'-'+String(Math.min(Number(s.dueDate.slice(8,10))||1,new Date(Number(p.invoiceMonth!.slice(0,4)),Number(p.invoiceMonth!.slice(5,7)),0).getDate())).padStart(2,'0')}))};}
 return projections.length?{...data,records:[...data.records,...projections],annotations}:data;
}
