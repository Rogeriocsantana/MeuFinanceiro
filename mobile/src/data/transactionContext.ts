import type {BankRecord,LocalBankData} from './pluggyModel';
import type {Control} from './localControls';
import {reserveMovement} from './bankOverview';

export function matchesTransactionContext(tx:BankRecord,context:string|undefined,data:LocalBankData,controls:Control[]){
 if(!context)return true;
 const annotation=data.annotations[tx.id],movement=reserveMovement(tx);
 if(context==='Cofrinho'||context.startsWith('Cofrinho:')){
  const goal=controls.find(c=>c.type==='goals'&&c.id===annotation?.controlId);
  if(context==='Cofrinho')return !!movement||!!goal||!!tx.metadata.reserveYield;
  const rest=context.slice('Cofrinho:'.length),separator=rest.indexOf(':');
  if(separator<0)return false;
  const accountId=rest.slice(0,separator),name=rest.slice(separator+1);
  return tx.accountId===accountId&&(movement?.name===name||goal?.name===name||tx.metadata.reserveName===name);
 }
 const belongsToPerson=(controlId:unknown)=>typeof controlId==='string'&&controls.some(c=>c.id===controlId&&c.person===context);
 const linkedToPerson=belongsToPerson(annotation?.controlId)||controls.some(c=>c.type==='reconciliations'&&(c.bankRecordId===tx.id||c.sourceBankRecordId===tx.id)&&belongsToPerson(c.controlId));
 return tx.accountId===context||linkedToPerson||annotation?.personName===context||!!annotation?.shares?.some(s=>s.person===context)||tx.name.toLocaleLowerCase().includes(context.toLocaleLowerCase());
}
