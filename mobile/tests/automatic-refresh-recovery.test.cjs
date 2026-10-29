const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};new Function('require','exports','module','__DEV__',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText)(name=>mocks[name]||require(name),m.exports,m,false);return m.exports;}
const automatic=load('src/services/automaticRefresh.ts'),preferences={refresh:{intervalMinutes:1440}};
test('falha tenta novamente após um minuto, sem esperar 24 horas ou duplicar chamadas',async()=>{
 let now=new Date('2026-10-26T12:00:00Z'),state={},calls=0;const run=automatic.automaticRefreshRunner({load:async()=>({preferences,state}),save:async s=>{state=s;},synchronize:async()=>{calls++;if(calls===1)throw Error('offline');},now:()=>now});
 await assert.rejects(run(),/offline/);assert.equal(await run(),false);now=new Date('2026-10-26T12:00:59Z');assert.equal(await run(),false);now=new Date('2026-10-26T12:01:00Z');await Promise.all([run(),run()]);assert.equal(calls,2);assert.equal(state.lastSuccessAt,now.toISOString());now=new Date('2026-10-26T13:00:00Z');assert.equal(await run(),false);
});
test('importação manual recente conta para o intervalo e modo manual não atualiza',()=>{
 const prefs={refresh:{intervalMinutes:60}},now=new Date('2026-10-26T12:00:00Z');assert.equal(automatic.refreshDue(prefs,{},now,'2026-10-26T11:30:00Z'),false);assert.equal(automatic.refreshDue(prefs,{},now,'2026-10-26T11:00:00Z'),true);assert.equal(automatic.refreshDue({refresh:{intervalMinutes:null}},{},now),false);
});
test('verifica na abertura e retomada; limpa ouvintes e ignora retorno após desmontar',async()=>{
 let active=true,listener,tick,runs=0,updates=0,removed=0,resolve;const stop=automatic.startForegroundRefresh({active:()=>active,run:()=>{runs++;return new Promise(r=>resolve=r);},updated:async()=>{updates++;},failed:()=>assert.fail('unexpected'),subscribe:fn=>{listener=fn;return()=>removed++;},repeat:fn=>{tick=fn;return()=>removed++;}});
 assert.equal(runs,1);resolve(true);await new Promise(setImmediate);assert.equal(updates,1);active=false;listener();tick();assert.equal(runs,1);active=true;listener();assert.equal(runs,2);stop();resolve(true);await new Promise(setImmediate);assert.equal(updates,1);tick();assert.equal(runs,2);assert.equal(removed,2);
});
test('erro de atualização em primeiro plano é comunicado',async()=>{
 let errors=0;const stop=automatic.startForegroundRefresh({active:()=>true,run:async()=>{throw Error('offline');},updated:async()=>assert.fail('no update'),failed:()=>errors++,subscribe:()=>()=>{},repeat:()=>()=>{}});await new Promise(setImmediate);assert.equal(errors,1);stop();
});
test('segundo plano mantém o agendamento se intervalo não mudou, mesmo com chamadas concorrentes',async()=>{
 let registered=false,options={},registrations=0,unregisters=0;const module=load('src/services/bankAutomation.ts',{'react-native':{Platform:{OS:'android'}},'expo-task-manager':{isTaskDefined:()=>true,isAvailableAsync:async()=>true,isTaskRegisteredAsync:async()=>registered,getTaskOptionsAsync:async()=>options},'expo-background-task':{registerTaskAsync:async(_,o)=>{registered=true;options=o;registrations++;},unregisterTaskAsync:async()=>{registered=false;unregisters++;}},'../data/pluggyRepository':{},'../data/appPreferences':{},'./refreshIndependent':load('src/services/refreshIndependent.ts'),'./automaticRefresh':automatic,'./pluggySync':{},'./remoteSync':{},'./notifications':{}});
 await Promise.all([module.configureAutomaticRefresh('owner',60),module.configureAutomaticRefresh('owner',60)]);assert.equal(registrations,1);await module.configureAutomaticRefresh('owner',30);assert.equal(registrations,2);await module.configureAutomaticRefresh('owner',null);assert.equal(unregisters,1);
});
test('oculta apenas rendimento sintético zerado, sem esconder lançamento bancário real',()=>{
 const list=load('src/preview/BankTransactionList.tsx',new Proxy({},{get:()=>({})}));const base={amountCents:0,metadata:{}};assert.equal(list.transactionIsVisible(base),true);assert.equal(list.transactionIsVisible({...base,metadata:{reserveYield:true}}),false);assert.equal(list.transactionIsVisible({...base,amountCents:344,metadata:{reserveYield:true}}),true);
});

test('atualização automática tenta D1 com banco bloqueado e mantém falha para nova tentativa',async()=>{
 let state={},remoteCalls=0;
 const block=Error('Vínculos aguardam conferência');
 const automation=load('src/services/bankAutomation.ts',{'react-native':{Platform:{OS:'android'}},'expo-task-manager':{isTaskDefined:()=>true},'expo-background-task':{},'../data/pluggyRepository':{loadBankData:async()=>({scope:'automatic-test'})},'../data/appPreferences':{loadAppPreferences:async()=>preferences,loadRefreshState:async()=>state,saveRefreshState:async s=>{state=s;}},'./refreshIndependent':load('src/services/refreshIndependent.ts'),'./automaticRefresh':automatic,'./pluggySync':{synchronizePluggy:async()=>{throw block;}},'./remoteSync':{synchronizeRemote:async()=>{remoteCalls++;}},'./notifications':{}});
 await assert.rejects(automation.runAutomaticRefresh('automatic-test'),e=>e===block);
 assert.equal(remoteCalls,1);assert.equal(state.lastSuccessAt,undefined);
});

for(const fails of [false,true])test('execução headless registra '+(fails?'falha':'conclusão')+' sem depender da tela aberta',async()=>{
 let callback,state={};const events=[];
 load('src/services/bankAutomation.ts',{'react-native':{Platform:{OS:'android'}},'expo-task-manager':{isTaskDefined:()=>false,defineTask:(_,fn)=>callback=fn},'expo-background-task':{BackgroundTaskResult:{Success:'ok',Failed:'failed'}},'../data/pluggyRepository':{loadBankData:async()=>({scope:'headless',records:[]})},'../data/appPreferences':{loadAppPreferences:async()=>preferences,loadRefreshState:async()=>state,saveRefreshState:async s=>{state=s;},saveDeviceEvent:async(_,key,value)=>events.push({key,...value})},'./refreshIndependent':load('src/services/refreshIndependent.ts'),'./automaticRefresh':automatic,'./pluggySync':{synchronizePluggy:async()=>{if(fails)throw Error('Vínculos pendentes');return {changed:0};}},'./remoteSync':{synchronizeRemote:async()=>{}},'./notifications':{scheduleFinancialNotifications:async()=>{},notifyBankUpdated:async()=>{}}});
 assert.equal(await callback(),fails?'failed':'ok');assert.equal(events[0].status,'running');assert.equal(events.at(-1).status,fails?'failed':'updated');if(fails)assert.match(events.at(-1).error,/Vínculos/);
});
