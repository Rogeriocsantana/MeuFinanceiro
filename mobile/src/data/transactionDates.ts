import type {BankRecord} from './pluggyModel';
/** Preserve calendar dates returned by the bank; a posting date is not a purchase date. */
export function transactionDisplayDate(tx:BankRecord){
 const day=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):'';
 const purchase=day(tx.metadata.purchaseDate);
 if(purchase)return {date:purchase,label:'Data da compra'};
 const posted=day(tx.metadata.billPostDate);
 if(posted)return {date:posted,label:'Postagem na fatura'};
 return {date:tx.metadata.card?day(tx.metadata.rawDate)||tx.date:tx.date,label:tx.metadata.card?'Data informada pelo banco':'Data do lançamento'};
}
