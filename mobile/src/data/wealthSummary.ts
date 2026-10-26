import type {LocalBankData} from './pluggyModel';
import type {Control} from './localControls';
import {latestReservePositions} from './reservePositions';
export function wealthSummary(data:LocalBankData,controls:Control[]){
 const accounts=data.records.filter(r=>r.kind==='account'&&r.status!=='DELETED'),positions=latestReservePositions(data.records);
 const available=accounts.reduce((n,a)=>n+a.amountCents,0),invested=controls.filter(c=>c.type==='investments').reduce((n,c)=>n+Number(c.amountCents||0),0);
 const reserves=positions.reduce((n,r)=>n+r.amountCents,0)+controls.filter(c=>c.type==='goals'&&!c.linkedAccountId&&!c.linkedInvestmentId&&!positions.some(r=>r.accountId===c.accountId&&r.name.toLocaleLowerCase()===c.name.toLocaleLowerCase())).reduce((n,c)=>n+Number(c.amountCents||0),0);
 return {available,reserves,invested,total:available+reserves+invested};
}
