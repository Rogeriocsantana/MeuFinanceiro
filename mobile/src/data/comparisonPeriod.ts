import type {LocalBankData} from './pluggyModel';
import type {Reconciliation} from './localControls';
/** A view over saved data: invoice grouping remains independent from purchase-date cutoff. */
export function comparisonPeriod(data:LocalBankData,receipts:Reconciliation[],month:string,selectedMonth:string,sameDay:boolean,today:string){
 if(!sameDay||selectedMonth!==today.slice(0,7))return {data,receipts,cutoff:null};
 const [year,m]=month.split('-').map(Number),last=new Date(Date.UTC(year!,m!,0)).getUTCDate(),cutoff=month+'-'+String(Math.min(Number(today.slice(8,10)),last)).padStart(2,'0');
 return {data:{...data,records:data.records.filter(r=>r.kind!=='transaction'||r.date<=cutoff)},receipts:receipts.filter(r=>r.date<=cutoff),cutoff};
}
