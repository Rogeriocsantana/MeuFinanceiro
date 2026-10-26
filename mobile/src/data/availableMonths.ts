import type {BankRecord} from './pluggyModel';
/** Numeric month offsets preserve the app's existing January-2026 origin across years. */
export function availableRecordMonths(records:BankRecord[],invoiceMonth?:(row:BankRecord)=>string){
 const months=new Set<number>();for(const row of records){if(row.kind!=='transaction'||['CANCELLED','DELETED'].includes(row.status))continue;const key=row.kind==='transaction'&&row.metadata.card?(invoiceMonth?.(row)||row.invoiceMonth||row.date.slice(0,7)):row.date.slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))continue;months.add((Number(key.slice(0,4))-2026)*12+Number(key.slice(5,7))-1);}return [...months].sort((a,b)=>a-b);
}
export function selectAvailableMonth(selected:number,available:number[],today=new Date()){if(!available.length||available.includes(selected))return selected;const current=(today.getFullYear()-2026)*12+today.getMonth();return available.includes(current)?current:available.reduce((a,b)=>Math.abs(b-current)<Math.abs(a-current)?b:a);}
