import {cents,providerDay,type BankRecord} from './pluggyModel';
/** A position is evidence, never a cash-account movement. Keep each provider timestamp. */
export function reservePositions(source:any,account:BankRecord):BankRecord[]{
 return (source.bankData?.reservedBalances||[]).map((reserve:any)=>{
  const key=String(reserve.identification||reserve.id||reserve.name||((source.bankData?.reservedBalances||[]).length===1?'single-unnamed-reserve':''));if(!key)throw Error('Cofrinho sem identificação na origem.');
  const amounts=reserve.availableAmounts;if(!Array.isArray(amounts)||!amounts.length)throw Error('Posição do cofrinho incompleta.');
  const amountCents=amounts.reduce((sum:number,value:any)=>{if(value.currencyCode&&value.currencyCode!=='BRL')throw Error('Cofrinho em moeda não suportada.');return sum+cents(value.amount);},0);
  if(!Number.isSafeInteger(amountCents)||amountCents<0)throw Error('Saldo do cofrinho inválido.');
  const stamp=account.metadata.sourceUpdatedAt;
  return {...account,id:account.itemId+':'+account.accountId+':reserve:'+encodeURIComponent(key)+':'+stamp,kind:'reserve-position' as const,name:reserve.name||'Cofrinho',amountCents,date:providerDay(stamp),metadata:{reserveKey:key,sourceUpdatedAt:stamp,position:true,unnamed:!reserve.name}};
 });
}
export function latestReservePositions(records:BankRecord[],accountId?:string){const map=new Map<string,BankRecord>();for(const row of records.filter(r=>r.kind==='reserve-position'&&(!accountId||r.accountId===accountId))){const key=row.itemId+'|'+row.accountId+'|'+row.metadata.reserveKey,old=map.get(key);if(!old||old.metadata.sourceUpdatedAt<row.metadata.sourceUpdatedAt)map.set(key,row);}return [...map.values()].map(row=>{const assigned=records.find(r=>r.kind==='reserve-position'&&r.itemId===row.itemId&&r.accountId===row.accountId&&r.metadata.reserveKey===row.metadata.reserveKey&&r.metadata.movementName)?.metadata.movementName;const names=[...new Set(records.filter(r=>r.kind==='transaction'&&r.status==='POSTED'&&r.itemId===row.itemId&&r.accountId===row.accountId).map(r=>r.name.match(/^Dinheiro (?:reservado|retirado)\s+(.+)$/i)?.[1]?.trim()).filter(Boolean))];const single=[...map.values()].filter(r=>r.itemId===row.itemId&&r.accountId===row.accountId&&r.amountCents>0).length===1&&row.amountCents>0;return {...row,name:assigned||(row.metadata.unnamed&&single&&names.length===1?names[0]:row.name)};});}
/** Rebuild intervals from all saved evidence, including history added later. No fabricated daily split. */
export function reserveYieldRecords(records:BankRecord[]){
 const groups=new Map<string,BankRecord[]>(),result:BankRecord[]=[];
 for(const row of records.filter(r=>r.kind==='reserve-position')){const key=row.itemId+'|'+row.accountId+'|'+row.metadata.reserveKey;groups.set(key,[...(groups.get(key)||[]),row]);}
 for(const positions of groups.values()){
  positions.sort((a,b)=>a.metadata.sourceUpdatedAt.localeCompare(b.metadata.sourceUpdatedAt));
  for(let i=1;i<positions.length;i++){
   const before=positions[i-1]!,after=positions[i]!,start=before.metadata.sourceUpdatedAt,end=after.metadata.sourceUpdatedAt;
   const named=positions.find(p=>p.metadata.movementName)?.metadata.movementName||(!after.metadata.unnamed?after.name:'');const names=[...new Set(records.filter(r=>r.kind==='transaction'&&r.status==='POSTED'&&r.itemId===after.itemId&&r.accountId===after.accountId).map(r=>r.name.match(/^Dinheiro (?:reservado|retirado)\s+(.+)$/i)?.[1]?.trim()).filter(Boolean))];const single=latestReservePositions(records,after.accountId).filter(r=>r.amountCents>0).length===1&&after.amountCents>0;const movementName=named||(single&&names.length===1?names[0]:'');const unresolved=!movementName;
   let flows=0;for(const tx of records.filter(r=>r.kind==='transaction'&&r.status==='POSTED'&&!r.metadata.reserveYield&&r.itemId===after.itemId&&r.accountId===after.accountId)){
    const match=tx.name.match(/^Dinheiro (reservado|retirado)\s+(.+)$/i);if(!match||match[2]!.trim().toLocaleLowerCase()!==String(movementName).toLocaleLowerCase())continue;
    const stamp=tx.metadata.rawDate;const inRange=stamp&&stamp.includes('T')?Date.parse(stamp)>Date.parse(start)&&Date.parse(stamp)<=Date.parse(end):tx.date>before.date&&tx.date<=after.date;
    if(inRange)flows+=match[1]!.toLowerCase()==='reservado'?Math.abs(tx.amountCents):-Math.abs(tx.amountCents);
   }
   const coverage=records.find(r=>r.kind==='account'&&r.itemId===after.itemId&&r.accountId===after.accountId)?.metadata.historyFrom;const incomplete=coverage&&new Date(Date.parse(before.date+'T12:00:00Z')+86400000).toISOString().slice(0,10)<coverage;
   const amountCents=after.amountCents-before.amountCents-flows;
   // Cross-month gaps cannot be assigned to a month without a closing position.
   const monthly=before.date.slice(0,7)===after.date.slice(0,7)||before.date===new Date(Date.UTC(Number(after.date.slice(0,4)),Number(after.date.slice(5,7))-1,0)).toISOString().slice(0,10);
   result.push({...after,id:'reserve-yield:'+before.id+'>'+after.id,kind:'transaction',name:'Rendimento · '+(movementName||after.name),amountCents,date:after.date,status:monthly&&!incomplete&&!unresolved&&amountCents>=0?'POSTED':'PENDING',metadata:{reserveYield:true,reserveKey:after.metadata.reserveKey,reserveName:movementName||after.name,card:false,from:start,to:end,reason:incomplete?'Amplie a importação até a posição inicial':unresolved?'Associe o nome dos movimentos do cofrinho':!monthly?'Falta posição de fechamento mensal':amountCents<0?'Conferir posições e movimentos':'',sourceId:after.id}});
  }
 }
 return result;
}
