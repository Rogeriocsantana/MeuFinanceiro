import {workerGet,loadWorkerConfig,assertConnectionOwner} from './worker';
import {cents,providerDay,transactionRecord,type BankRecord,type LocalBankData} from '../data/pluggyModel';
export type BankDiagnostic={account:BankRecord;localBalance:number|null;sourceUpdatedAt:string|null;status:string;consistent:boolean;posted:BankRecord[];pending:BankRecord[];missingIds:string[];latest:string|null;balanceMatches:boolean|null};
/** Read-only provider comparison. Never imports, reconciles or writes a balance. */
export async function inspectBankConnections(local:LocalBankData|null,from:string,to:string):Promise<BankDiagnostic[]>{
 const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 if(!valid(from)||!valid(to)||from>to)throw Error('Confira as datas do intervalo.');
 const config=await loadWorkerConfig();if(!config)throw Error('Conecte primeiro o servidor para consultar os bancos.');
 const me=await workerGet('/v1/me');if(!me.id||!Array.isArray(me.itemIds)||!me.itemIds.length)throw Error('Cadastre os IDs das conexões Pluggy.');
 assertConnectionOwner(local?.scope,config.url+'|'+me.id);
 const results:BankDiagnostic[]=[];
 for(const itemId of [...new Set<string>(me.itemIds)]){
  const base='/v1/pluggy/items/'+encodeURIComponent(itemId),info=await workerGet(base+'/info'),accounts:any[]=[];
  let complete=false;for(let page=1;page<=500;page++){const data=await workerGet(base+'/accounts?page='+page);if(!Array.isArray(data.results))throw Error('Lista de contas incompleta.');accounts.push(...data.results);if(!data.totalPages||page>=data.totalPages){complete=true;break;}}if(!complete)throw Error('Lista de contas excedeu o limite de consulta.');
  const start=results.length;
  for(const source of accounts){
   if(!['BANK','CREDIT'].includes(source.type))continue;
   if(!source.id||source.itemId!==itemId||source.currencyCode!=='BRL')throw Error('Conta incompatível ou de outra conexão.');
   const stamp=info.lastUpdatedAt&&Number.isFinite(Date.parse(info.lastUpdatedAt))?new Date(info.lastUpdatedAt).toISOString():null;
   const account:BankRecord={id:itemId+':account:'+source.id,kind:source.type==='CREDIT'?'card':'account',itemId,accountId:source.id,name:source.name||'Conta',institution:info.connector?.name||'Instituição',amountCents:cents(source.balance),currency:'BRL',date:stamp?providerDay(stamp):to,status:'ACTIVE',metadata:{subtype:source.subtype||'',sourceUpdatedAt:stamp}};
   const rows=new Map<string,BankRecord>(),cursors=new Set<string>();let after='',finished=false;
   for(let page=0;page<500;page++){
    const data=await workerGet(base+'/transactions?accountId='+encodeURIComponent(source.id)+(after?'&after='+encodeURIComponent(after):''));if(!Array.isArray(data.results))throw Error('Histórico incompleto na origem.');
    for(const tx of data.results){const row=transactionRecord(tx,account),old=rows.get(row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw Error('A origem retornou movimentos duplicados divergentes.');rows.set(row.id,row);}
    if(!data.next){finished=true;break;}after=new URL(data.next,'https://api.pluggy.ai/v2/transactions').searchParams.get('after')||'';if(!after||cursors.has(after))throw Error('Paginação inconsistente na origem.');cursors.add(after);
   }
   if(!finished)throw Error('Histórico excedeu o limite de consulta.');
   const inRange=[...rows.values()].filter(r=>r.date>=from&&r.date<=to&&!['CANCELLED','DELETED'].includes(r.status)).sort((a,b)=>b.date.localeCompare(a.date)),posted=inRange.filter(r=>r.status==='POSTED'),pending=inRange.filter(r=>r.status!=='POSTED'),saved=local?.records.find(r=>r.id===account.id),ids=new Set(local?.records.filter(r=>r.kind==='transaction'&&r.status==='POSTED').map(r=>r.id));
   results.push({account,localBalance:saved?.amountCents??null,sourceUpdatedAt:stamp,status:info.status||'Não informado',consistent:info.status==='UPDATED'&&!!stamp,posted,pending,missingIds:posted.filter(r=>!ids.has(r.id)).map(r=>r.id),latest:posted[0]?.date||null,balanceMatches:saved?saved.amountCents===account.amountCents:null});
  }
  const end=await workerGet(base+'/info');if(end.status!==info.status||end.lastUpdatedAt!==info.lastUpdatedAt)for(const row of results.slice(start))row.consistent=false;
 }
 return results;
}
