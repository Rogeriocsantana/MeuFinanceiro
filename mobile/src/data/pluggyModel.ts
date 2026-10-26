export type BankRecord={id:string;kind:'account'|'card'|'transaction'|'bill'|'reserve-position';itemId:string;accountId:string;name:string;institution:string;amountCents:number;currency:string;date:string;invoiceMonth?:string;status:string;metadata:Record<string,any>};
export type LocalAnnotation={purchaseLabel?:string;purchaseSeriesId?:string;seriesOwnerId?:string|null;categoryId?:string;receiptRemainder?:{amountCents:number;nature:'Receita';categoryId:string};compensations?:{controlId:string;installmentId?:string;amountCents:number;reason:string;categoryId:string}[];nature?:string;event?:string;controlId?:string;personId?:string;personName?:string;shares?:{person:string;amount:string;dueDate:string;id:string}[];links?:Record<string,unknown>;notes?:string;sourceAmountCentsAtEdit?:number};
export type BankSnapshot={scope:string;records:BankRecord[];syncedAt:string;warnings:string[]};
export type LocalBankData=BankSnapshot&{annotations:Record<string,LocalAnnotation>};
export const SYNC_SCHEMA=`
CREATE TABLE IF NOT EXISTS pluggy_records(scope TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),updated_at TEXT NOT NULL,PRIMARY KEY(scope,id));
CREATE TABLE IF NOT EXISTS pluggy_annotations(scope TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,PRIMARY KEY(scope,id));
CREATE TABLE IF NOT EXISTS pluggy_sync(scope TEXT PRIMARY KEY,payload TEXT NOT NULL CHECK(json_valid(payload)));
`;
export const UPSERT_REMOTE=`INSERT INTO pluggy_records(scope,id,kind,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(scope,id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,updated_at=excluded.updated_at WHERE pluggy_records.payload<>excluded.payload`;
export function cents(value:unknown){const amount=Number(value);if(value===null||value===undefined||value===''||!Number.isFinite(amount)||!Number.isSafeInteger(Math.round(amount*100)))throw new Error('A instituição retornou um valor inválido.');return Math.round(amount*100);}
export function transactionRecord(tx:any,account:BankRecord):BankRecord{
 if(!tx.id||tx.accountId!==account.accountId||!/^\d{4}-\d{2}-\d{2}/.test(tx.date||''))throw new Error('Movimento incompleto ou de outra conta.');
 if((tx.currencyCode||account.currency)!=='BRL')throw new Error('Movimento em moeda estrangeira precisa de conversão antes de importar.');
 const amount=cents(tx.amountInAccountCurrency??tx.amount),card=account.kind==='card',meta=tx.creditCardMetadata||{};
 const signed=card?-amount:amount;
 return {id:account.itemId+':'+account.accountId+':tx:'+tx.id,kind:'transaction',itemId:account.itemId,accountId:account.accountId,name:String(tx.descriptionRaw||tx.description||'Movimento'),institution:account.institution,amountCents:signed,currency:'BRL',date:providerDay(tx.date),invoiceMonth:meta.billForecastDate?String(meta.billForecastDate).slice(0,7):undefined,status:tx.status||'POSTED',metadata:{rawDate:tx.date,purchaseDate:meta.purchaseDate||null,billPostDate:meta.billPostDate||null,transactionDateTime:meta.transactionDateTime||null,paymentType:meta.paymentType||null,sourceId:tx.id,card,providerCategory:tx.category||'',type:tx.type,operationType:tx.operationType||'',billId:meta.billId||'',installmentNumber:meta.installmentNumber||null,totalInstallments:meta.totalInstallments||null}};
}

/** Provider completion time is independent from the time the app attempted a refresh. */
export function bankSourceFreshness(records:BankRecord[]){const times=records.filter(r=>r.kind==='account'||r.kind==='card').map(r=>Date.parse(r.metadata.sourceUpdatedAt||'')).filter(Number.isFinite);return times.length?{oldest:new Date(Math.min(...times)).toISOString(),newest:new Date(Math.max(...times)).toISOString()}:null;}
export function providerDay(raw:string){if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=new Date(raw);if(!Number.isFinite(d.getTime()))throw new Error('Data bancária inválida.');const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const part=(name:string)=>parts.find(p=>p.type===name)!.value;return part('year')+'-'+part('month')+'-'+part('day');}
/** Validate the entire batch before any SQLite write. Initial provider position is a baseline, not income. */
export function validateBankUpdate(snapshot:BankSnapshot,previous:BankRecord[],allowBalanceWarning=false){
 for(const account of snapshot.records.filter(r=>r.kind==='account'||r.kind==='card')){const old=previous.find(r=>r.id===account.id&&r.kind===account.kind);if(!old)continue;const stamp=account.metadata.sourceUpdatedAt,priorStamp=old.metadata.sourceUpdatedAt;if(priorStamp&&(!stamp||Date.parse(stamp)<Date.parse(priorStamp)))throw new Error('A posição bancária é anterior à posição salva. Dados preservados.');
  const before=previous.filter(r=>r.kind==='transaction'&&r.itemId===account.itemId&&r.accountId===account.accountId),after=snapshot.records.filter(r=>r.kind==='transaction'&&r.itemId===account.itemId&&r.accountId===account.accountId);let delta=0;
  for(const row of after){const prior=before.find(r=>r.id===row.id);if(prior?.status==='POSTED'&&(row.status!=='POSTED'||prior.amountCents!==row.amountCents||prior.date!==row.date))throw new Error('Movimento confirmado mudou na origem. Concilie antes de atualizar; vínculos preservados.');if(!row.metadata?.reserveYield&&row.status==='POSTED'&&prior?.status!=='POSTED'&&(prior?.status==='PENDING'||!priorStamp||(row.metadata?.rawDate?.includes('T')?Date.parse(row.metadata.rawDate)>Date.parse(priorStamp):row.date>(old.date||providerDay(priorStamp)))))delta+=row.amountCents;}
  if(account.kind==='account'&&priorStamp&&stamp&&old.amountCents+delta!==account.amountCents){if(!allowBalanceWarning)throw new Error('O saldo bancário não fecha com os movimentos confirmados desde a posição anterior. Nenhum dado foi gravado.');snapshot.warnings.push(account.name+': saldo atualizado pela origem; o histórico disponível não explica toda a variação.');}
 }
}


export function bankRevisionKey(row:BankRecord){return JSON.stringify([row.amountCents,row.date,row.status,row.invoiceMonth||'',row.name,row.metadata?.billId||'']);}
export function bankRevisionFields(saved:BankRecord,received:BankRecord){
 const fields:[string,string,string][]=[];
 if(saved.amountCents!==received.amountCents)fields.push(['Valor',String(saved.amountCents),String(received.amountCents)]);
 if(saved.date!==received.date)fields.push(['Data',saved.date,received.date]);
 if(saved.status!==received.status)fields.push(['Status',saved.status,received.status]);
 if((saved.invoiceMonth||'')!==(received.invoiceMonth||''))fields.push(['Fatura',saved.invoiceMonth||'Não informada',received.invoiceMonth||'Não informada']);
 if(saved.name!==received.name)fields.push(['Descrição',saved.name,received.name]);
 if((saved.metadata?.billId||'')!==(received.metadata?.billId||''))fields.push(['Identificação da fatura',saved.metadata?.billId||'Não informada',received.metadata?.billId||'Não informada']);
 return fields;
}
/** Source changes await a durable user decision; unrelated imports continue. */
export function prepareBankUpdate(snapshot:BankSnapshot,previous:BankRecord[]):BankSnapshot{
 const prior=new Map(previous.map(row=>[row.id,row])),warnings=[...snapshot.warnings];let held=0;
 const records=snapshot.records.map(row=>{const old=prior.get(row.id);if(row.kind!=='transaction'||!old)return row;
  const key=bankRevisionKey(row),decision=old.metadata?.sourceDecision;
  if(decision?.key===key&&decision.choice==='keep'){const metadata={...old.metadata};delete metadata.sourceRevision;return {...old,metadata};}
  if(bankRevisionKey(old)===key)return {...row,metadata:{...row.metadata,...(decision?{sourceDecision:decision}:{})}};
  held++;const priorRevision=old.metadata?.sourceRevision,revision=priorRevision?.key===key?priorRevision:{key,record:row,amountCents:row.amountCents,date:row.date,status:row.status,observedAt:snapshot.syncedAt};return {...old,metadata:{...old.metadata,sourceRevision:revision}};
 });
 if(held)warnings.push(held+' alteração(ões) bancária(s) aguardam sua decisão em Configurações → Importações → Alterações para conferir. Os demais dados foram atualizados.');
 const result={...snapshot,records,warnings};validateBankUpdate(result,previous,true);return result;
}
export function resolveBankRevision(record:BankRecord,key:string,choice:'keep'|'accept',at:string):BankRecord{
 const revision=record.metadata?.sourceRevision,received=revision?.record as BankRecord|undefined;
 if(!received||revision.key!==key||bankRevisionKey(received)!==key)throw Error('A alteração mudou. Reabra a conferência antes de decidir.');
 if(received.id!==record.id||received.accountId!==record.accountId||received.itemId!==record.itemId||received.kind!==record.kind)throw Error('Identidade bancária divergente; decisão cancelada.');
 const selected=choice==='accept'?received:record,metadata={...selected.metadata};delete metadata.sourceRevision;
 metadata.sourceDecision={key,choice,decidedAt:at};return {...selected,metadata};
}

/** Card history is selected by bill reference, independently of the bank's original purchase date. */
export function bankRecordInImportPeriod(record:BankRecord,from:string,records:BankRecord[]=[]){
 if(record.metadata.card){const bill=record.metadata.billId?records.find(b=>b.kind==='bill'&&b.itemId===record.itemId&&b.accountId===record.accountId&&(b.metadata.sourceId===record.metadata.billId||b.id===record.metadata.billId)):undefined;const month=bill?.date.slice(0,7)||record.invoiceMonth;if(month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return month>=from.slice(0,7);}
 return record.date>=from;
}
