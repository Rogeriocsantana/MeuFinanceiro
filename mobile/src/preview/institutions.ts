// Institution identities are independent of account/card fixtures. Unknown banks use a neutral mark.
export type InstitutionIdentity={id:string;name:string;aliases:string[];mark:string;background:string;color:string;cardBackground?:string;cardColor?:string};
export const institutions:InstitutionIdentity[]=[
 {id:'itau',name:'Itaú',aliases:['itau','itaú'],mark:'itaú',background:'#ff7900',color:'#fff',cardBackground:'#205de1'},
 {id:'mercado-pago',name:'Mercado Pago',aliases:['mercado pago'],mark:'MP',background:'#e4f7ff',color:'#0077ad',cardBackground:'#196e90'},
 {id:'nubank',name:'Nubank',aliases:['nubank','nu pagamentos','nu financeira'],mark:'nu',background:'#820ad1',color:'#fff'},
 {id:'banco-do-brasil',name:'Banco do Brasil',aliases:['banco do brasil','bco do brasil','bb'],mark:'BB',background:'#fff36b',color:'#1253a6',cardBackground:'#fff36b',cardColor:'#1253a6'},
 {id:'bradesco',name:'Bradesco',aliases:['bradesco','banco bradesco','bco bradesco'],mark:'B',background:'#cc092f',color:'#fff'},
 {id:'santander',name:'Santander',aliases:['santander','banco santander','bco santander'],mark:'S',background:'#ec0000',color:'#fff'},
 {id:'caixa',name:'Caixa',aliases:['caixa'],mark:'C',background:'#0065a8',color:'#fff'},
 {id:'inter',name:'Inter',aliases:['banco inter','inter'],mark:'Inter',background:'#ff7a00',color:'#fff'},
 {"id":"picpay","name":"PicPay","aliases":["picpay","picpay bank"],"mark":"PicPay","background":"#21c25e","color":"#fff"},
 {"id":"c6-bank","name":"C6 Bank","aliases":["c6","c6 bank","banco c6","bco c6"],"mark":"C6","background":"#242424","color":"#fff"},
 {"id":"btg-pactual","name":"BTG Pactual","aliases":["btg","btg pactual","banco btg pactual"],"mark":"BTG","background":"#002b49","color":"#fff"},
 {"id":"safra","name":"Safra","aliases":["safra","banco safra","bco safra","j. safra"],"mark":"Safra","background":"#172c54","color":"#fff"},
 {"id":"sicredi","name":"Sicredi","aliases":["sicredi","banco sicredi","banco cooperativo sicredi"],"mark":"Sicredi","background":"#33820d","color":"#fff"},
 {"id":"sicoob","name":"Sicoob","aliases":["sicoob","banco sicoob","banco cooperativo sicoob"],"mark":"Sicoob","background":"#003641","color":"#fff"},
 {"id":"neon","name":"Neon","aliases":["neon","neon pagamentos"],"mark":"Neon","background":"#007f9f","color":"#fff"},
 {"id":"pagbank","name":"PagBank","aliases":["pagbank","pagseguro","pagseguro internet"],"mark":"PagBank","background":"#006f52","color":"#fff"},
 {"id":"original","name":"Banco Original","aliases":["banco original","original"],"mark":"Original","background":"#00834b","color":"#fff"},
];
const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function institutionIdentity(name:string):InstitutionIdentity{
 const normalized=normalize(name),known=institutions.find(i=>i.id===normalized||i.aliases.some(alias=>normalized===normalize(alias)||normalized.startsWith(normalize(alias)+' ')));
 if(known)return known;
 const clean=name.replace(/\s+(conta|crédito|credito|cartão|cartao)$/i,'').trim()||'Instituição';
 return {id:normalize(clean).replace(/\s+/g,'-'),name:clean,aliases:[clean],mark:clean.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(),background:'#edf1f7',color:'#667085'};
}
export const institutionOptions=['Selecione',...institutions.map(i=>i.name),'Outra instituição'];
export const demoAccounts=[
 {id:'demo-account-itau',institutionId:'itau',name:'Itaú Conta',balanceCents:235020,reserveCents:0,balanceDate:'15/10/2026'},
 {id:'demo-account-mp',institutionId:'mercado-pago',name:'Mercado Pago Conta',balanceCents:110000,reserveCents:500000,balanceDate:'15/10/2026'},
];
export const demoCards=[
 {id:'demo-card-itau',institutionId:'itau',name:'Itaú Crédito',closingDay:3,dueDay:10,limitCents:500000,statements:[148000,162000,184290],personalOpenCents:162900},
 {id:'demo-card-mp',institutionId:'mercado-pago',name:'Mercado Pago Crédito',closingDay:5,dueDay:10,limitCents:500000,statements:[148000,162000,56720],personalOpenCents:35330},
];
export function selectedDemoCard(value:string){return demoCards.find(c=>c.id===value||c.name===value||c.institutionId===value||institutionIdentity(value).id===c.institutionId);}
export const demoConnectedInstitutions=institutions.filter(i=>demoAccounts.some(a=>a.institutionId===i.id)||demoCards.some(c=>c.institutionId===i.id));

/** Resolve legacy records whose connector label is a Pluggy application name. */
export function bankPresentation(record:{name:string;institution:string;kind:string}){
 const provider=institutionIdentity(record.institution);
 const account=institutionIdentity(record.name);
 const knownProvider=institutions.some(i=>i.id===provider.id);
 const knownAccount=institutions.some(i=>i.id===account.id);
 const technical=/pluggy/i.test(record.institution);
 const identity=knownProvider?provider:knownAccount?account:institutionIdentity(technical?record.name:record.institution);
 const suffix=record.kind==='card'?'Crédito':'Conta';
 const bareName=normalize(record.name)===normalize(identity.name)||identity.aliases.some(alias=>normalize(alias)===normalize(record.name));
 return {identity,title:bareName?identity.name+' '+suffix:record.name,institution:technical&&!knownAccount&&!knownProvider?'':identity.name};
}
