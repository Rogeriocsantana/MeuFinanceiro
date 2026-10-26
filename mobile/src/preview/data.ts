// Exemplos independentes dos dados reais. Nenhum valor vem da Pluggy ou Apps Script.
const fixtureTransactions = [
  {id:'demo-t1',name:'Supermercado Primavera',detail:'Mercado · Itaú Crédito',date:'15 out',amount:-18642,icon:'cart',category:'Mercado',person:''},
  {id:'demo-t2',name:'Café da esquina',detail:'Restaurante · Mercado Pago',date:'15 out',amount:-2450,icon:'coffee',category:'Restaurante',person:''},
  {id:'demo-t3',name:'Restaurante Jardim',detail:'Restaurante · Itaú Crédito',date:'14 out',amount:-7800,icon:'food',category:'Restaurante',person:''},
  {id:'demo-t4',name:'Loja Online · parcela 2/6',detail:'Sites · Itaú Crédito',date:'14 out',amount:-12990,icon:'bag',category:'Sites',person:'Clara'},
  {id:'demo-t5',name:'Salário',detail:'Salário · Itaú Conta',date:'10 out',amount:540000,icon:'income',category:'Salário',person:''},
  {id:'demo-t6',name:'Internet residencial',detail:'Internet · Mercado Pago',date:'09 out',amount:-9990,icon:'home',category:'Internet',person:''},
  {id:'demo-t7',name:'Delivery do bairro',detail:'Delivery · Itaú Crédito',date:'08 out',amount:-4580,icon:'food',category:'Delivery',person:''},
  {id:'demo-t8',name:'Aplicativo de transporte',detail:'Uber · Mercado Pago',date:'07 out',amount:-1890,icon:'car',category:'Uber',person:''}
];
const fixtureOrigins:Record<string,{accountId:string|null;cardId:string|null;institutionId:string}>={
 'demo-t1':{accountId:null,cardId:'demo-card-itau',institutionId:'itau'},
 'demo-t2':{accountId:'demo-account-mp',cardId:null,institutionId:'mercado-pago'},
 'demo-t3':{accountId:null,cardId:'demo-card-itau',institutionId:'itau'},
 'demo-t4':{accountId:null,cardId:'demo-card-itau',institutionId:'itau'},
 'demo-t5':{accountId:'demo-account-itau',cardId:null,institutionId:'itau'},
 'demo-t6':{accountId:'demo-account-mp',cardId:null,institutionId:'mercado-pago'},
 'demo-t7':{accountId:null,cardId:'demo-card-itau',institutionId:'itau'},
 'demo-t8':{accountId:'demo-account-mp',cardId:null,institutionId:'mercado-pago'},
};
export const transactions=fixtureTransactions.map(tx=>({...tx,...fixtureOrigins[tx.id]!,shareDueDate:'2026-11-10'}));
export type DemoTransaction = typeof transactions[number];
export const categories = [
  {name:'Casa',amount:148000,color:'#205dff',icon:'home',children:[['Aluguel',110000],['Condomínio',28000],['Internet',10000]] as [string,number][]},
  {name:'Alimentação',amount:93250,color:'#ed6862',icon:'food',children:[['Mercado',56000],['Restaurante',21750],['Delivery',15500]] as [string,number][]},
  {name:'Compras',amount:51400,color:'#2faf8a',icon:'bag',children:[['Sites',51400]] as [string,number][]},
  {name:'Transporte',amount:28600,color:'#edb83d',icon:'car',children:[['Uber',28600]] as [string,number][]}
];
export const people = [{name:'Clara',initial:'C',color:'#8c7bdc',card:12990,loan:40000},{name:'Miguel',initial:'M',color:'#5a9dcd',card:8400,loan:120000},{name:'Sofia',initial:'S',color:'#d08a65',card:0,loan:60000}];
export const navigation = [
  {key:'home',label:'Início',icon:'home'}, {key:'accounts',label:'Contas',icon:'wallet'},
  {key:'cards',label:'Cartões',icon:'card'}, {key:'analysis',label:'Análises',icon:'chart'}, {key:'more',label:'Mais',icon:'more'}
];
export const titles:Record<string,string> = {'setup-guide':'Guia de configuração',home:'Financeiro',accounts:'Contas',account:'Minha conta',cards:'Cartões',transactions:'Lançamentos',income:'Receitas e rendimentos',assets:'Patrimônio',analysis:'Análises',category:'Categoria',controls:'Meus controles',people:'Pessoas',person:'Pessoa',loans:'Empréstimos',loan:'Empréstimo',future:'Futuro',settings:'Configurações',categories:'Classificações',rules:'Regras automáticas',imports:'Open Finance',integrations:'Integrações',onboarding:'Primeira configuração',backup:'Backup e sincronização',more:'Mais',development:'Laboratório local'};

// Vínculo ilustrativo para conferir o estado vinculado sem dados reais.
export const demoLoanSendings:Record<string,{accountId:string;date:string;description:string;amountCents:number}>={Miguel:{accountId:"demo-account-itau",date:"05/10/2026",description:"Envio de empréstimo",amountCents:200000}};
