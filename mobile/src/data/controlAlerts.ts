import {expenseCategoryTotals} from './bankOverview';
import {cardInvoiceMonth} from './cardInvoice';
import type {LocalBankData} from './pluggyModel';
import {resolveCategories} from './settingsModel';
import type {Control,Reconciliation} from './localControls';
export function controlAlertEvents(data:LocalBankData,controls:Control[],today:string){
 const month=today.slice(0,7),setting=controls.find(c=>c.id==='monthly-limits'),limits=(setting?.limits||{}) as Record<string,string>,flags=(setting?.controlAlerts||{}) as Record<string,boolean>,threshold=Number(String(setting?.alertThreshold||'80%').replace('%',''))||80;
 const normalized={...data,records:data.records.map(r=>r.kind==='transaction'?{...r,invoiceMonth:cardInvoiceMonth(data,r,controls)}:r)},totals=expenseCategoryTotals(normalized,month,controls.filter(c=>c.type==='reconciliations') as unknown as Reconciliation[],controls),categories=resolveCategories(controls);
 return Object.entries(limits).flatMap(([name,value])=>{if(!flags[name])return [];const max=Math.round(Number(value.replace(/\./g,'').replace(',','.'))*100),category=categories.find(c=>c.name===name);if(!max||!category)return [];const ids=new Set([category.id,...categories.filter(c=>c.parentKey===category.id).map(c=>c.id)]),amount=totals.filter(t=>ids.has(t.categoryId)).reduce((n,r)=>n+r.amountCents,0),percent=amount/max*100;if(percent<threshold)return [];const band=percent>=100?100:threshold;return [{key:JSON.stringify(['limit',name,month,band,setting?.alertFrequency==='Só quando mudar de faixa'?'band':today]),name,month,amount,limit:max,percent:Math.round(percent)}];});
}
