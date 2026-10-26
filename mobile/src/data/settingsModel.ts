import {categoryCatalog} from '../preview/categoryCatalog';
import type {BankRecord,LocalAnnotation} from './pluggyModel';
export type CategoryControl={id:string;type:'categories';name:string;kind:string;isGroup:boolean;parentKey:string;disabled?:boolean};
export type RuleControl={id:string;type:'rules';name:string;condition:string;priority:number;categoryId:string;nature:string;person?:string;personId?:string;accountId?:string;cardId?:string;includeClassified?:boolean;disabled?:boolean};
export function resolveCategories(controls:{id:string;type:string;[key:string]:any}[]):CategoryControl[]{
 const merged=new Map<string,CategoryControl>(categoryCatalog.map(c=>[c.key,{id:c.key,type:'categories',name:c.name,kind:c.kind,isGroup:c.isGroup,parentKey:c.parentKey}]));
 for(const c of controls.filter(c=>c.type==='categories'))merged.set(c.id,c as CategoryControl);
 const categories=[...merged.values()];return categories.sort((a,b)=>categoryLabel(a,categories).localeCompare(categoryLabel(b,categories),'pt-BR',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));
}
export function categoryLabel(category:CategoryControl,categories:CategoryControl[]){const parent=categories.find(c=>c.id===category.parentKey);return parent?parent.name+' › '+category.name:category.name;}
export function validateCategory(value:CategoryControl,categories:CategoryControl[]){
 if(!value.name.trim())throw Error('Informe o nome.');
 const children=categories.filter(c=>c.parentKey===value.id&&!c.disabled);
 if(children.length&&!value.isGroup)throw Error('Desvincule as subcategorias antes de remover a classificação principal.');
 if(value.isGroup&&value.kind!=='BOTH'&&children.some(c=>c.kind!==value.kind))throw Error('O tipo precisa ser compatível com as subcategorias.');
 if(value.parentKey){const parent=categories.find(c=>c.id===value.parentKey&&!c.disabled);if(!parent?.isGroup||parent.id===value.id)throw Error('Selecione uma categoria principal válida.');if(value.isGroup)throw Error('Uma classificação principal não pode ser subcategoria.');if(parent.kind!=='BOTH'&&value.kind!==parent.kind)throw Error('O tipo precisa ser compatível com a categoria principal.');}
}
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
export function ruleMatches(rule:RuleControl,tx:BankRecord,annotation:LocalAnnotation={}){
 if(rule.disabled||tx.kind!=='transaction'||tx.status==='DELETED'||!rule.name.trim())return false;
 if(!rule.includeClassified&&annotation.categoryId)return false;
 if(rule.accountId&&tx.accountId!==rule.accountId||rule.cardId&&tx.accountId!==rule.cardId)return false;
 // An automatic category must never replace a financial event or settled allocation.
 if(annotation.event&&annotation.event!=='Nenhum evento'||annotation.controlId||annotation.compensations?.length||annotation.receiptRemainder||(annotation as any).receiptRounding||annotation.links&&Object.keys(annotation.links).length)return false;
 if(rule.person&&(annotation.shares?.length||annotation.seriesOwnerId!==undefined))return false;
 if(rule.person&&(!tx.metadata?.card||tx.amountCents>=0))return false;
 if(['Receita','Rendimento'].includes(rule.nature)&&tx.amountCents<=0||rule.nature==='Despesa'&&tx.amountCents>=0)return false;
 if(rule.nature==='Pagamento de fatura')return false;
 if(rule.nature==='Transferência / reserva'&&(tx.metadata?.card||tx.status==='CANCELLED'||!tx.amountCents||rule.person||annotation.shares?.length||annotation.seriesOwnerId!==undefined))return false;
 const text=normalized(tx.name),needle=normalized(rule.name);
 return rule.condition==='Igual a'?text===needle:rule.condition==='Começa com'?text.startsWith(needle):text.includes(needle);
}
function cardBillDueDate(tx:BankRecord,records:BankRecord[]){
 const bills=records.filter(r=>r.kind==='bill'&&r.accountId===tx.accountId&&(!tx.itemId||r.itemId===tx.itemId));
 const billId=String(tx.metadata?.billId||'');
 const exact=billId?bills.filter(r=>r.id===billId||String(r.metadata?.sourceId||'')===billId):[];
 const byMonth=tx.invoiceMonth?bills.filter(r=>r.date.slice(0,7)===tx.invoiceMonth):[];
 const candidate=exact.length===1?exact[0]:!billId&&byMonth.length===1?byMonth[0]:undefined;
 if(candidate&&/^\d{4}-\d{2}-\d{2}$/.test(candidate.date))return candidate.date;
 const card=records.find(r=>r.kind==='card'&&r.accountId===tx.accountId&&(!tx.itemId||r.itemId===tx.itemId)),due=String(card?.metadata?.dueDate||'').slice(0,10);
 return !billId&&tx.invoiceMonth&&due.slice(0,7)===tx.invoiceMonth&&/^\d{4}-\d{2}-\d{2}$/.test(due)?due:undefined;
}
export function ruleChanges(rules:RuleControl[],records:BankRecord[],annotations:Record<string,LocalAnnotation>,controls:{type:string;bankRecordId?:unknown}[]=[]){
 const linked=new Set(controls.filter(c=>c.type==='reconciliations'&&typeof c.bankRecordId==='string').map(c=>c.bankRecordId));
 const sorted=rules.filter(r=>!r.disabled).slice().sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 return records.flatMap(tx=>{if(linked.has(tx.id))return[];const previous=annotations[tx.id]||{},matches=sorted.filter(r=>ruleMatches(r,tx,previous)),rule=matches[0];if(!rule)return[];const outcomes=new Set(matches.filter(r=>Number(r.priority)===Number(rule.priority)).map(r=>JSON.stringify([r.nature,r.categoryId,r.person?(r.personId||r.person):''])));if(outcomes.size>1)return[];const dueDate=rule.person?cardBillDueDate(tx,records):undefined;if(rule.person&&!dueDate)return[];const next={...previous,categoryId:rule.nature==='Transferência / reserva'?'':rule.categoryId,nature:rule.nature,...(rule.nature==='Transferência / reserva'?{event:'Transferência / aporte ou resgate'}:{}),...(rule.person?{personName:rule.person,personId:rule.personId||rule.person,shares:[{id:'rule-full:'+tx.id,person:rule.person,amount:(Math.abs(tx.amountCents)/100).toFixed(2).replace('.',','),dueDate:dueDate!}]}:{}),sourceAmountCentsAtEdit:tx.amountCents};return JSON.stringify(next)===JSON.stringify(previous)?[]:[{id:tx.id,name:tx.name,ruleId:rule.id,annotation:next}];});
}
export function rulesWithSavedRule(rules:RuleControl[],record:RuleControl){return [...rules.filter(rule=>rule.id!==record.id).map(rule=>({...rule,includeClassified:false})),record];}

export function ruleOriginKind(label:string):'account'|'card'|undefined{return label==='Somente nesta conta'?'account':label==='Somente neste cartão'?'card':undefined;}
