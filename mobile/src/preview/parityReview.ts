import {Platform} from 'react-native';
import {demoAccounts,demoCards} from './institutions';
import {transactions} from './data';
import {categoryCatalog} from './categoryCatalog';
import {applyBankSnapshot,loadBankData} from '../data/pluggyRepository';
import {saveControl,classifyBankRecord} from '../data/localControls';
import type {BankRecord} from '../data/pluggyModel';
// Development-only isolated origin. This is not a demonstration mode in the APK.
export function parityReviewMode(){
 if(!__DEV__)return '';
 if(process.env.EXPO_PUBLIC_VISUAL_REFINEMENT_REVIEW==='1')return 'candidate';
 if(Platform.OS==='android'&&process.env.EXPO_PUBLIC_NATIVE_PARITY_REVIEW==='1')return 'candidate';
 return Platform.OS==='web'&&typeof location!=='undefined'&&location.hostname==='127.0.0.1'&&location.port==='8097'?new URLSearchParams(location.search).get('parity')||'':'';
}
let pending:Promise<void>|undefined;
export function prepareParityReview(){return pending??=seed();}
async function seed(){
 if(parityReviewMode()!=='candidate')return;
 const old=await loadBankData();if(old){if(old.scope!=='parity-review')throw Error('A base de revisão já pertence a outro perfil.');
  if(process.env.EXPO_PUBLIC_VISUAL_REFINEMENT_REVIEW==='1'){
   const upgraded:BankRecord[]=old.records.filter(r=>(r.id.match(/:refinement:/g)||[]).length>1&&r.status!=='DELETED').map(r=>({...r,status:'DELETED'}));
   for(const tx of old.records.filter(r=>r.kind==='transaction'&&r.metadata.card&&!r.id.includes(':refinement:'))){
    const match=tx.name.match(/parcela\s+(\d+)\/(\d+)/i);if(!match)continue;
    const number=Number(match[1]),total=Number(match[2]);
    if(!tx.metadata.installmentNumber)upgraded.push({...tx,metadata:{...tx.metadata,installmentNumber:number,totalInstallments:total}});
    for(const [offset,month] of [[-1,'2026-09'],[1,'2026-11'],[2,'2026-12']] as const){const id=tx.id+':refinement:'+offset,n=number+offset;if(n<1||n>total||old.records.some(r=>r.id===id))continue;upgraded.push({...tx,id,name:tx.name.replace(/parcela\s+\d+\/\d+/i,'parcela '+n+'/'+total),invoiceMonth:month,date:month+'-14',metadata:{...tx.metadata,installmentNumber:n,totalInstallments:total}});}
   }
   if(upgraded.length)await applyBankSnapshot({scope:old.scope,records:upgraded,syncedAt:old.syncedAt,warnings:old.warnings});
  }
  return;}
 const records:BankRecord[]=[...demoAccounts.map(a=>({id:a.id,kind:'account' as const,itemId:'review',accountId:a.id,name:a.name,institution:a.institutionId,amountCents:a.balanceCents,currency:'BRL',date:'2026-10-15',status:'ACTIVE',metadata:{subtype:'CHECKING_ACCOUNT'}})),...demoCards.map(c=>({id:c.id,kind:'card' as const,itemId:'review',accountId:c.id,name:c.name,institution:c.institutionId,amountCents:c.statements[2]!,currency:'BRL',date:'2026-10-15',status:'ACTIVE',metadata:{creditLimit:c.limitCents/100}})),...demoCards.flatMap(c=>[8,9,10].map((m,i)=>({id:c.id+':bill:'+m,kind:'bill' as const,itemId:'review',accountId:c.id,name:'Fatura',institution:c.institutionId,amountCents:c.statements[i]!,currency:'BRL',date:'2026-'+String(m+1).padStart(2,'0')+'-10',status:'IMPORTED',metadata:{sourceId:c.id+':bill:'+m,closingDate:'2026-'+String(m+1).padStart(2,'0')+'-03'}}))),...transactions.map(t=>({id:t.id,kind:'transaction' as const,itemId:'review',accountId:t.cardId||t.accountId||'',name:t.name,institution:t.institutionId,amountCents:t.amount,currency:'BRL',date:'2026-10-'+t.date.split(' ')[0]!.padStart(2,'0'),invoiceMonth:t.cardId?'2026-10':undefined,status:'POSTED',metadata:{card:!!t.cardId,installmentNumber:t.person?2:null,totalInstallments:t.person?6:null}}))];
 await applyBankSnapshot({scope:'parity-review',records,syncedAt:'2026-10-15T15:00:00Z',warnings:[]});
 for(const name of ['Clara','Miguel','Sofia'])await saveControl('parity-review',{id:'person-'+name,type:'people',name});
 await saveControl('parity-review',{id:'goal-apartment',type:'goals',name:'Meu apartamento',amountCents:500000,targetCents:800000,accountId:'demo-account-mp',date:'2026-12-31'});
 await saveControl('parity-review',{id:'loan-miguel',type:'loans',name:'Empréstimo pessoal',person:'Miguel',amountCents:200000,principalCents:200000,monthlyCents:40000,installments:6,date:'2026-07-20'});
 for(const t of transactions)await classifyBankRecord('parity-review',t.id,{nature:t.amount>0?'Receita':'Despesa',categoryId:categoryCatalog.find(c=>c.name===t.category)?.key,shares:t.person?[{id:'share-'+t.id,person:t.person,amount:(Math.abs(t.amount)/100).toFixed(2).replace('.',','),dueDate:'2026-11-10'}]:[]});
 await saveControl('parity-review',{id:'monthly-limits',type:'settings',name:'Limites mensais',limits:{Casa:'1600,00',Alimentação:'1000,00'}});
}
