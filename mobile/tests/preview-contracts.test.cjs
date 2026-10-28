const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,replacements={}){const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',code)(name=>replacements[name]||require(name),mod.exports,mod);return mod.exports;}
test('valores em reais conservam centavos e rejeitam texto ambíguo',()=>{
 const {maskMoneyValue,parseMoneyCents}=load('src/preview/formValues.ts');
 assert.equal(maskMoneyValue('1234,56'), '1.234,56');
 assert.equal(maskMoneyValue('79,9',true),'79,90');
 assert.equal(parseMoneyCents('1.234,56'),123456);
 assert.equal(parseMoneyCents('79,90')+parseMoneyCents('50,00'),12990);
 assert.ok(Number.isNaN(parseMoneyCents('1,2,3')));
});
test('instituição desconhecida não assume identidade nem fatura de outro banco',()=>{
 const {institutionIdentity,selectedDemoCard}=load('src/preview/institutions.ts');
 assert.equal(institutionIdentity('Nubank Crédito').id,'nubank');
 assert.equal(institutionIdentity('Cooperativa Aurora Conta').mark,'CA');
 assert.equal(selectedDemoCard('Cooperativa Aurora Crédito'),undefined);
});
test('classificação respeita o contexto e só oferece rateio no crédito',()=>{
 const {categoryCatalog}=load('src/preview/categoryCatalog.ts');
 const {classificationSpec}=load('src/preview/parityForms.ts',{'./categoryCatalog':{categoryCatalog},'./institutions':load('src/preview/institutions.ts'),'../data/pluggyModel':load('src/data/pluggyModel.ts')});
 const credit=classificationSpec({name:'Compra',amountCents:-12990,card:true},{});
 assert.equal(credit.shares,true);
 assert.ok(!credit.fields.find(f=>f.label==='Vincular a um evento').options.includes('Pagamento de fatura'));
 const account=classificationSpec({name:'Débito',amountCents:-12990,card:false},{});
 assert.equal(account.shares,false);
 assert.ok(account.fields.find(f=>f.label==='Vincular a um evento').options.includes('Pagamento de fatura'));
 const transfer=classificationSpec({name:'Débito',amountCents:-12990,card:false},{'Vincular a um evento':'Transferência / aporte ou resgate'});
 assert.ok(!transfer.fields.some(f=>f.label==='Categoria'));
});


test('ações bloqueiam repetição antes do render e liberam em sucesso/erro',async()=>{
 const {createActionGate}=load('src/preview/actionGate.ts');
 let release;const events=[];let calls=0;
 const gate=createActionGate(id=>events.push(id),1200,()=>new Promise(resolve=>{release=resolve;}));
 const first=gate.run('salvar',()=>{calls++;});
 assert.equal(await gate.run('salvar',()=>{calls++;}),false);
 assert.equal(await gate.run('outra-ação',()=>{calls++;}),false);
 assert.equal(calls,0);release();await first;assert.equal(calls,1);assert.deepEqual(events,['salvar',null]);
 const failing=gate.run('falha',()=>{throw new Error('esperado');});release();await assert.rejects(failing,/esperado/);
 const retry=gate.run('tentar',()=>{calls++;});release();await retry;assert.equal(calls,2);
});
test('ação pendente não executa depois de desmontar a prévia',async()=>{
 const {createActionGate}=load('src/preview/actionGate.ts');let release,calls=0;
 const gate=createActionGate(()=>{},1200,()=>new Promise(resolve=>{release=resolve;}));
 const pending=gate.run('salvar',()=>{calls++;});gate.dispose();release();assert.equal(await pending,false);assert.equal(calls,0);
});

test('carregamento descreve o verbo da ação',()=>{const {busyLabel}=load('src/preview/busyLabel.ts');for(const [label,expected] of [['Salvar controles','Salvando…'],['Registrar recebido','Registrando…'],['Criar e vincular envio','Criando…'],['Aplicar filtros','Aplicando…'],['Atualizar tudo','Atualizando…'],['Simular','Simulando…']])assert.equal(busyLabel(label),expected);});

test('subcategoria respeita o grupo inclusive ao reduzir o grupo',()=>{const {validateControlLimits}=load('src/preview/controlLimits.ts',{'./formValues':load('src/preview/formValues.ts')});const cats=[{key:'g',name:'Casa'},{key:'s',name:'Aluguel',parentKey:'g'}];assert.equal(validateControlLimits({Casa:'1.000,00',Aluguel:'1.000,00'},cats),'');assert.match(validateControlLimits({Casa:'999,99',Aluguel:'1.000,00'},cats),/Aluguel.*Casa/);assert.equal(validateControlLimits({Aluguel:'1.000,00'},cats),'');assert.match(validateControlLimits({Casa:''},cats),/válido/);});

test('Apps Script rejeita filho acima do grupo antes de persistir',()=>{const vm=require('node:vm'),source=fs.readFileSync('tests/fixtures/budget-validation.gs','utf8');const start=source.indexOf('function produtoControlesSalvar(input)'),end=source.indexOf('function pluggyOpenPayment_',start);let saved=null;const categories={g:{id:'g',name:'Casa',kind:'EXPENSE'},s:{id:'s',name:'Aluguel',kind:'EXPENSE',parent_id:'g'}};const ctx={pluggyOwner_:()=>{},prodSession_:fn=>fn(),prodRequired_:(_,id)=>categories[id],PropertiesService:{getScriptProperties:()=>({setProperty:(_,value)=>{saved=JSON.parse(value);}})}};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);assert.throws(()=>ctx.produtoControlesSalvar({items:[{categoryId:'g',limit:999.99},{categoryId:'s',limit:1000}]}),/Aluguel.*Casa/);assert.equal(saved,null);ctx.produtoControlesSalvar({items:[{categoryId:'s',limit:1000},{categoryId:'g',limit:1000}]});assert.equal(saved.length,2);ctx.produtoControlesSalvar({items:[]});assert.equal(saved.length,0);});

test('Worker configurável só é salvo após autenticar e segredo Pluggy não vai ao aparelho',async()=>{const values=new Map(),storage={getItemAsync:async key=>values.get(key)||null,setItemAsync:async(key,value)=>values.set(key,value)},api=load('src/services/worker.ts',{'./workerStorage':storage}),original=global.fetch;try{assert.throws(()=>api.validateWorkerUrl('http://worker.test'));assert.throws(()=>api.validateWorkerUrl('https://user:secret@worker.test'));assert.throws(()=>api.validateWorkerUrl('https://worker.test/?key=secret'));assert.equal(api.validateWorkerUrl('https://meu-worker.workers.dev/'),'https://meu-worker.workers.dev');global.fetch=async()=>new Response(JSON.stringify({error:'UNAUTHORIZED'}),{status:401});await assert.rejects(()=>api.connectWorker({url:'https://worker.test',token:'a'.repeat(43)}));assert.equal(values.size,0);global.fetch=async(url,options)=>new Response(JSON.stringify(String(url).endsWith('/v1/me')?{id:'test-owner',itemIds:[]}:options.method==='PUT'?{configured:true}:{service:'financeiro-api',credentialStorage:true,pluggyConfigured:false,d1Enabled:false,version:'0.2.0'}));await api.connectWorker({url:'https://worker.test',token:'a'.repeat(43)});const result=await api.savePluggyConfig('id','pluggy-private-secret',[]);assert.equal(result.pluggyConfigured,true);assert.ok(!JSON.stringify([...values]).includes('pluggy-private-secret'));}finally{global.fetch=original;}});

test('IDs Pluggy aceitam formato do Apps Script, vírgulas e linhas',()=>{const {parsePluggyItems}=load('src/services/pluggyItems.ts');assert.deepEqual(parsePluggyItems('"one", "two"'),['one','two']);assert.deepEqual(parsePluggyItems('["one","two"]'),['one','two']);assert.deepEqual(parsePluggyItems('one\ntwo\none'),['one','two']);assert.deepEqual(parsePluggyItems(''),[]);assert.throws(()=>parsePluggyItems('["one",123]'));assert.throws(()=>parsePluggyItems('invalid/id'));});

test('identidade bancária não usa o nome técnico da conexão Pluggy',()=>{
 const {bankPresentation}=load('src/preview/institutions.ts');
 const itau=bankPresentation({name:'itau',institution:'MeuPluggy',kind:'account'});
 assert.equal(itau.identity.id,'itau');assert.equal(itau.title,'Itaú Conta');assert.equal(itau.institution,'Itaú');
 const mp=bankPresentation({name:'Mercado Pago',institution:'MeuPluggy',kind:'card'});
 assert.equal(mp.identity.id,'mercado-pago');assert.equal(mp.title,'Mercado Pago Crédito');
 const real=bankPresentation({name:'itau',institution:'Nubank',kind:'account'});
 assert.equal(real.identity.id,'nubank');
 const unknown=bankPresentation({name:'Cooperativa Aurora Conta',institution:'MeuPluggy',kind:'account'});
 assert.equal(unknown.identity.mark,'CA');assert.equal(unknown.institution,'');
});

test('arquivo de conexão valida HTTPS e token sem importar credenciais Pluggy',()=>{
 const worker=load('src/services/worker.ts',{'./workerStorage':{}});
 const {parseConnectionProfile}=load('src/services/connectionProfile.ts',{'./worker':worker});
 const make=server=>JSON.stringify({format:'financeiro-connection',version:1,server});
 assert.deepEqual(parseConnectionProfile(make({url:'https://server.test/',token:'a'.repeat(43)})),{url:'https://server.test',token:'a'.repeat(43)});
 assert.deepEqual(parseConnectionProfile(make({url:'https://server.test',token:''})),{url:'https://server.test',token:''});
 assert.throws(()=>parseConnectionProfile(make({url:'http://server.test',token:''})));
 assert.throws(()=>parseConnectionProfile(make({url:'https://server.test',token:'bad'})));
 assert.throws(()=>parseConnectionProfile('{bad'));
 assert.throws(()=>parseConnectionProfile(' '.repeat(8193)));
 const safe=parseConnectionProfile(make({url:'https://server.test',token:'',clientSecret:'never-import'}));
 assert.ok(!JSON.stringify(safe).includes('never-import'));
});

test('conexão funciona no Android sem AbortSignal.timeout',async()=>{
 const api=load('src/services/worker.ts',{'./workerStorage':{setItemAsync:async()=>{},getItemAsync:async()=>null}});
 const originalFetch=global.fetch,originalSignal=global.AbortSignal;
 try{global.AbortSignal=class AndroidAbortSignal{};global.fetch=async(url,options)=>{assert.ok(options.signal);return new Response(JSON.stringify({service:'financeiro-api',credentialStorage:true,pluggyConfigured:true,id:'android-test'}));};const status=await api.connectWorker({url:'https://worker.test',token:'a'.repeat(43)});assert.equal(status.pluggyConfigured,true);}finally{global.fetch=originalFetch;global.AbortSignal=originalSignal;}
});


test('importar outro familiar após reiniciar não troca o dono do SQLite nem a conexão',async()=>{
 const values=new Map(),storage={getItemAsync:async k=>values.get(k)||null,setItemAsync:async(k,v)=>values.set(k,v)};
 const api=load('src/services/worker.ts',{'./workerStorage':storage}),original=global.fetch;
 let user='family';global.fetch=async url=>new Response(JSON.stringify(String(url).endsWith('/v1/me')?{id:user,itemIds:[]}:{service:'financeiro-api',credentialStorage:true,pluggyConfigured:false}));
 try{
  await assert.rejects(()=>api.connectWorker({url:'https://worker.test',token:'b'.repeat(43)},'https://worker.test|owner'),/outra pessoa/);
  assert.equal(values.size,0);
  user='owner';await api.connectWorker({url:'https://worker.test',token:'a'.repeat(43)},'https://worker.test|owner');const before=JSON.stringify([...values]);
  user='family';await assert.rejects(()=>api.connectWorker({url:'https://worker.test',token:'b'.repeat(43)}),/outra pessoa/);assert.equal(JSON.stringify([...values]),before);
  user='owner';await api.connectWorker({url:'https://worker.test',token:'c'.repeat(43)},'https://worker.test|owner');assert.ok(values.get('financeiro-worker-connection').includes('c'.repeat(43)));
 }finally{global.fetch=original;}
});
