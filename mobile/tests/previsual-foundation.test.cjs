const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
function fixture(filename=':memory:'){
 const db=new DatabaseSync(filename),cache=new Map();
 const adapter={execAsync:async q=>db.exec(q),runAsync:async(q,...a)=>db.prepare(q).run(...a),getFirstAsync:async(q,...a)=>db.prepare(q).get(...a)||null,getAllAsync:async(q,...a)=>db.prepare(q).all(...a),withExclusiveTransactionAsync:async work=>{db.exec('BEGIN');try{await work(adapter);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}};
 const stubs={'react-native':{Platform:{OS:'android'}},'expo-crypto':{randomUUID:crypto.randomUUID}};
 function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const req=name=>stubs[name]||(name==='./database'?{database:async()=>adapter}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name));new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m,m.exports);return m.exports;}
 db.exec(load('src/data/schema.ts').SCHEMA+load('src/data/pluggyModel.ts').SYNC_SCHEMA+load('src/data/remoteRepository.ts').REMOTE_SCHEMA);db.exec("INSERT OR IGNORE INTO remote_state(scope,enabled) VALUES('owner',1)");
 return {db,load,bank:load('src/data/pluggyRepository.ts'),purchases:load('src/data/purchaseRepository.ts'),prefs:load('src/data/appPreferences.ts'),controls:load('src/data/localControls.ts')};
}
const person={id:'ana',type:'people',name:'Ana'},scope='owner';
const tx=(n,extra={})=>({id:'tx'+n,kind:'transaction',itemId:'item',accountId:'card',name:'MERCADO LIVRE PARCELA '+n+'/3',institution:'Itaú',currency:'BRL',amountCents:-10000,date:'2026-'+String(n+8).padStart(2,'0')+'-01',invoiceMonth:'2026-'+String(n+8).padStart(2,'0'),status:'POSTED',metadata:{card:true,installmentNumber:n,totalInstallments:3},...extra});
const bill=n=>({id:'bill'+n,kind:'bill',itemId:'item',accountId:'card',date:'2026-'+String(n+8).padStart(2,'0')+'-10',amountCents:10000,status:'IMPORTED',metadata:{sourceId:'bill'+n}});
const snapshot=records=>({scope,records,syncedAt:'2026-10-20T12:00:00Z',warnings:[]});
test('dono aceita vencimento explícito para meses sem fatura e preserva vencimento oficial futuro',async()=>{
 const f=fixture();try{await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2)]));await f.controls.saveControl(scope,person);const original=JSON.stringify((await f.bank.loadBankData()).records);
 await assert.rejects(f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana',dueDay:0}),/1 e 31/);
 await f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana',dueDay:31});let data=await f.bank.loadBankData();assert.equal(data.annotations.tx1.shares[0].dueDate,'2026-09-30');assert.equal(data.annotations.tx2.shares[0].dueDate,'2026-10-31');assert.equal(JSON.stringify(data.records),original);
 await f.bank.applyBankSnapshot(snapshot([tx(3),bill(3)]));await f.purchases.applySavedPurchaseSeries(scope);data=await f.bank.loadBankData();assert.equal(data.annotations.tx3.shares[0].dueDate,'2026-11-10');assert.equal((await f.controls.listControls()).filter(c=>c.type==='card-settings').length,0);
 }finally{f.db.close();}
});
async function seed(f){await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2),bill(1),bill(2)]));await f.controls.saveControl(scope,person);}
test('nome e dono explícitos alcançam parcelas antigas e futuras sem regra nem alteração da origem',async()=>{
 const f=fixture();try{await seed(f);const before=JSON.stringify((await f.bank.loadBankData()).records);const saved=await f.purchases.savePurchaseSeries(scope,'tx2',{label:'Teclado Mecânico',ownerId:'ana'});assert.equal(saved.changed,2);let data=await f.bank.loadBankData();assert.equal(JSON.stringify(data.records),before);assert.equal(data.annotations.tx1.purchaseLabel,'Teclado Mecânico');assert.equal(data.annotations.tx1.shares[0].dueDate,'2026-09-10');assert.equal(data.annotations.tx2.shares[0].amount,'100,00');assert.equal((await f.purchases.savePurchaseSeries(scope,'tx1',{label:'Teclado Mecânico'})).changed,0);assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).changed,0);
 await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2),tx(3),bill(3)]));assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).changed,1);data=await f.bank.loadBankData();assert.equal(data.annotations.tx3.personId,'ana');assert.equal(data.annotations.tx3.purchaseLabel,'Teclado Mecânico');assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).changed,0);assert.equal((await f.controls.listControls()).filter(c=>c.type==='rules').length,0);
 await f.purchases.savePurchaseSeries(scope,'tx2',{label:''});data=await f.bank.loadBankData();assert.ok(Object.values(data.annotations).every(n=>n.purchaseLabel===''&&n.personId==='ana'));await assert.rejects(f.purchases.savePurchaseSeries('other','tx1',{label:'wrong'}),/conexão/);
 }finally{f.db.close();}
});
test('série preserva divisão manual futura, vínculos quitados e exclusões; nome continua editável',async()=>{
 const f=fixture();try{await seed(f);await f.purchases.savePurchaseSeries(scope,'tx1',{label:'Celular',ownerId:'ana'});
 const obligations=f.controls.deriveObligations(await f.bank.loadBankData(),await f.controls.listControls()),destination=obligations.find(c=>c.transactionId==='tx1');await f.controls.reconcileControls(scope,[{id:'receipt',controlId:destination.id,amountCents:5000,date:'2026-09-10',direction:'receipt'}],[destination]);await f.controls.saveControl(scope,{id:'bia',type:'people',name:'Bia'});
 await assert.rejects(f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'bia'}),/vínculos/);assert.equal((await f.bank.loadBankData()).annotations.tx2.personId,'ana');await f.purchases.savePurchaseSeries(scope,'tx1',{label:'Celular novo'});assert.equal((await f.bank.loadBankData()).annotations.tx1.shares[0].id,destination.id.slice(('share:tx1:').length));
 await f.bank.applyBankSnapshot(snapshot([tx(3),bill(3)]));const note={notes:'Manual',shares:[{id:'manual',person:'Bia',amount:'50,00',dueDate:'2026-11-10'}]};await f.bank.saveBankAnnotation(scope,'tx3',note);let result=await f.purchases.applySavedPurchaseSeries(scope);assert.equal(result.conflicts.length,1);assert.deepEqual((await f.bank.loadBankData()).annotations.tx3,note);await f.bank.saveBankAnnotation(scope,'tx3',{_deletedAt:'now'});result=await f.purchases.applySavedPurchaseSeries(scope);assert.equal(result.conflicts.length,1);assert.equal((await f.bank.loadBankData()).annotations.tx3._deletedAt,'now');
 }finally{f.db.close();}
});
test('compras indistinguíveis não agrupam silenciosamente e falta de vencimento não grava parcialmente',async()=>{
 const f=fixture();try{await seed(f);await f.bank.applyBankSnapshot(snapshot([tx(2,{id:'duplicate'})]));await assert.rejects(f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana'}),/indistinguíveis/);assert.equal((await f.controls.listControls()).filter(c=>c.type==='purchase-series').length,0);
 }finally{f.db.close();}
 const g=fixture();try{await g.bank.applyBankSnapshot(snapshot([tx(1),tx(2)]));await g.controls.saveControl(scope,person);await assert.rejects(g.purchases.savePurchaseSeries(scope,'tx1',{label:'Celular',ownerId:'ana'}),/Vencimento/);assert.equal(Object.keys((await g.bank.loadBankData()).annotations).length,0);assert.equal((await g.controls.listControls()).length,1);}finally{g.db.close();}
});
test('falha da fila reverte decisão e anotações; nome não ressuscita dados após rollback',async()=>{
 const f=fixture();try{await seed(f);const revision=f.db.prepare("SELECT value FROM local_meta WHERE key='revision'").get().value;f.db.exec("CREATE TRIGGER fail_series BEFORE INSERT ON remote_queue WHEN NEW.entity_type='annotations' BEGIN SELECT RAISE(ABORT,'disk full'); END");await assert.rejects(f.purchases.savePurchaseSeries(scope,'tx1',{label:'Celular',ownerId:'ana'}),/disk full/);assert.equal((await f.controls.listControls()).length,1);assert.deepEqual((await f.bank.loadBankData()).annotations,{});assert.equal(f.db.prepare("SELECT value FROM local_meta WHERE key='revision'").get().value,revision);}finally{f.db.close();}
});
test('preferências, fotos e deduplicação persistem ao reabrir SQLite e ficam fora da fila remota',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'financeiro-previsual-')),filename=path.join(dir,'preferences.db');let f=fixture(filename);try{await seed(f);const value=f.prefs.defaultAppPreferences();assert.equal(value.notifications.enabled,false);value.profile={name:' Rogério ',photo:'data:image/png;base64,aGVsbG8='};value.refresh.intervalMinutes=15;await f.prefs.saveAppPreferences(scope,value);await f.prefs.savePersonPhoto(scope,'ana',value.profile.photo);assert.equal(await f.prefs.recordDeviceEvent(scope,'invoice:2026-10:card',{status:'delivered'}),true);f.db.close();f=fixture(filename);assert.equal((await f.prefs.loadAppPreferences(scope)).profile.name,'Rogério');assert.equal(await f.prefs.loadPersonPhoto(scope,'ana'),value.profile.photo);assert.equal(await f.prefs.recordDeviceEvent(scope,'invoice:2026-10:card',{}),false);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM remote_queue').get().n,5);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM device_preferences').get().n,2);await assert.rejects(f.prefs.savePersonPhoto(scope,'missing',null),/Pessoa/);await assert.rejects(f.prefs.saveAppPreferences(scope,{...value,refresh:{intervalMinutes:1}}),/intervalo/);await assert.rejects(f.prefs.saveAppPreferences(scope,{...value,profile:{name:'x',photo:'file:///tmp/lost.jpg'}}),/foto/);assert.equal((await f.prefs.loadAppPreferences(scope)).refresh.intervalMinutes,15);}finally{f.db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('fatura filtra a participação por pessoa e agrupa dias sem perder estorno ou descrição original',()=>{
 const f=fixture();try{const query=f.load('src/data/invoiceDetails.ts').invoiceDetails,records=[tx(2,{invoiceMonth:'2026-11',metadata:{...tx(2).metadata,billId:'bill2'}}),bill(2),tx(2,{id:'refund',amountCents:2000,metadata:{card:true}})],data={...snapshot(records),annotations:{tx2:{purchaseLabel:'Teclado',personId:'ana',personName:'Ana',shares:[{id:'s',person:'Ana',amount:'40,00',dueDate:'2026-10-10'}]}}},selection={itemId:'item',accountId:'card',month:'2026-10'};let result=query(data,selection,[person]);assert.equal(result.selectedTotalCents,8000);assert.equal(result.ownCents,4000);assert.equal(result.othersCents,4000);assert.equal(result.days.length,1);assert.equal(result.rows.find(r=>r.id==='tx2').name,'Teclado');assert.match(result.rows.find(r=>r.id==='tx2').originalName,/MERCADO LIVRE/);result=query(data,{...selection,person:'ana'},[person]);assert.equal(result.selectedTotalCents,4000);assert.equal(result.rows.length,1);assert.equal(query(data,{...selection,person:'self'},[person]).selectedTotalCents,4000);assert.equal(query(data,{...selection,sharedOnly:true},[person]).selectedTotalCents,10000);}finally{f.db.close();}
});
test('atualização automática evita concorrência e respeita intervalo, modo manual e falha',async()=>{
 const f=fixture();try{const {automaticRefreshRunner,refreshDue}=f.load('src/services/automaticRefresh.ts'),preferences=f.prefs.defaultAppPreferences();preferences.refresh.intervalMinutes=15;let state={},calls=0,now=new Date('2026-10-20T12:00:00Z');const runner=automaticRefreshRunner({load:async()=>({preferences,state}),save:async next=>{state=next;},synchronize:async()=>{calls++;},now:()=>now});const a=runner(),b=runner();assert.equal(a,b);await a;assert.equal(calls,1);assert.equal(await runner(),false);now=new Date('2026-10-20T12:15:00Z');await runner();assert.equal(calls,2);preferences.refresh.intervalMinutes=null;assert.equal(refreshDue(preferences,{},now),false);preferences.refresh.intervalMinutes=15;const failed=automaticRefreshRunner({load:async()=>({preferences,state:{}}),save:async next=>{state=next;},synchronize:async()=>{throw Error('offline');},now:()=>now});await assert.rejects(failed(),/offline/);assert.ok(state.lastAttemptAt);assert.equal(state.lastSuccessAt,undefined);}finally{f.db.close();}
});
test('regra automática de pessoa não altera dono próprio escolhido explicitamente na série',()=>{
 const f=fixture();try{const model=f.load('src/data/settingsModel.ts');assert.equal(model.ruleMatches({name:'MERCADO',condition:'Contém',person:'Ana',includeClassified:true},tx(1),{seriesOwnerId:null,shares:[]}),false);}finally{f.db.close();}
});
test('séries concorrentes ficam para revisão e não escolhem o último rótulo por acaso',async()=>{
 const f=fixture();try{await seed(f);const saved=await f.purchases.savePurchaseSeries(scope,'tx1',{label:'Original'});const duplicate={...saved.series,id:'concurrent-series',label:'Concorrente'};await f.controls.saveControl(scope,duplicate);const result=await f.purchases.applySavedPurchaseSeries(scope);assert.equal(result.changed,0);assert.equal(result.conflicts.length,2);assert.equal((await f.bank.loadBankData()).annotations.tx1.purchaseLabel,'Original');}finally{f.db.close();}
});
test('fatura separa pendentes, meses desconhecidos e cartões de instituições diferentes',()=>{
 const f=fixture();try{const query=f.load('src/data/invoiceDetails.ts').invoiceDetails,data={...snapshot([tx(2),tx(2,{id:'pending',status:'PENDING'}),tx(2,{id:'other-item',itemId:'other'}),tx(2,{id:'unknown',invoiceMonth:undefined})]),annotations:{}},selection={itemId:'item',accountId:'card',month:'2026-10'};assert.equal(query(data,selection).selectedTotalCents,10000);const result=query(data,{...selection,includePending:true});assert.equal(result.selectedTotalCents,20000);assert.equal(result.rows.filter(r=>r.pending).length,1);assert.deepEqual(result.unresolvedTransactionIds,['unknown']);}finally{f.db.close();}
});
test('lembretes respeitam opções, quitação, vencimentos e chaves estáveis',()=>{
 const f=fixture();try{
  const {notificationPlan}=f.load('src/data/notificationPlan.ts'),preferences=f.prefs.defaultAppPreferences(),data=snapshot([bill(2)]),loan={id:'loan',type:'loans',name:'Contrato',person:'Ana',amountCents:20000,principalCents:20000,monthlyCents:10000,installments:2,dueDate:'2026-10-20'};
  const now=new Date('2026-10-01T12:00:00Z');assert.deepEqual(notificationPlan(data,[loan],preferences,now),[]);
  preferences.notifications={enabled:true,types:['invoice-due','loan-due','bank-updated']};
  const plan=notificationPlan(data,[loan],preferences,now);assert.equal(plan.length,3);assert.equal(new Set(plan.map(e=>e.id)).size,3);assert.deepEqual(notificationPlan(data,[loan],preferences,now).map(e=>e.id),plan.map(e=>e.id));assert.equal(plan[0].at.toISOString(),'2026-10-10T12:00:00.000Z');assert.equal(notificationPlan(data,[loan,{id:'s',type:'card-settings',accountId:'card','dueDate:2026-10':'2026-10-15'}],preferences,now)[0].at.toISOString(),'2026-10-10T12:00:00.000Z');
  const paid=[{id:'paid-bill',type:'reconciliations',date:'2026-10-01',controlId:'bill2',amountCents:10000,direction:'bill-payment'},{id:'paid-loan',type:'reconciliations',controlId:'loan',amountCents:20000,direction:'receipt'}];assert.deepEqual(notificationPlan(data,[loan,...paid],preferences,now),[]);
  preferences.notifications.types=['bank-updated'];assert.deepEqual(notificationPlan(data,[loan],preferences,now),[]);
 }finally{f.db.close();}
});
test('patrimônio das novas telas mantém posições e metas vinculadas sem duplicar',()=>{
 const f=fixture();try{const {wealthSummary}=f.load('src/data/wealthSummary.ts'),account={id:'a',kind:'account',status:'ACTIVE',accountId:'a',amountCents:10000},data=snapshot([account]);const value=wealthSummary(data,[{id:'i',type:'investments',amountCents:30000},{id:'g',type:'goals',amountCents:20000},{id:'linked',type:'goals',amountCents:30000,linkedInvestmentId:'i'}]);assert.deepEqual(value,{available:10000,reserves:20000,invested:30000,total:60000});}finally{f.db.close();}
});

test('nome pertence à compra inteira com horários diferentes, decisões antigas e parcelas novas',async()=>{
 const f=fixture();try{const part=n=>tx(n,{metadata:{card:true,installmentNumber:n,totalInstallments:3,purchaseDate:n===1?'2026-08-01T15:00:01Z':'2026-08-01T18:00:01Z'}});await f.bank.applyBankSnapshot(snapshot([part(1),part(2)]));const saved=await f.purchases.savePurchaseSeries(scope,'tx1',{label:'Teclado'});const copy={...saved.series,id:'old-split',sourceTransactionId:'tx2'};f.db.prepare('INSERT INTO entity_records VALUES(?,?,?,?,?,?)').run('purchase-series',copy.id,JSON.stringify(copy),1,'now',null);await f.purchases.savePurchaseSeries(scope,'tx2',{label:'Teclado Mecânico'});let d=await f.bank.loadBankData();assert.equal(d.annotations.tx1.purchaseLabel,'Teclado Mecânico');assert.equal(d.annotations.tx2.purchaseLabel,'Teclado Mecânico');await f.bank.applyBankSnapshot(snapshot([part(3)]));await f.purchases.applySavedPurchaseSeries(scope);d=await f.bank.loadBankData();for(const n of [1,2,3])assert.equal(d.annotations['tx'+n].purchaseLabel,'Teclado Mecânico');assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).changed,0);assert.equal(f.load('src/data/purchaseSeries.ts').installmentPurchases(d,await f.controls.listControls()).length,1);}finally{f.db.close();}
});

test('escolha explícita de dono resolve decisões antigas diferentes da mesma compra',async()=>{
 const f=fixture();try{await seed(f);await f.controls.saveControl(scope,{id:'bea',type:'people',name:'Bea'});const saved=await f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana',label:'Compra'});const duplicate={...saved.series,id:'old-owner',sourceTransactionId:'tx2',ownerId:'bea'};f.db.prepare('INSERT INTO entity_records VALUES(?,?,?,?,?,?)').run('purchase-series',duplicate.id,JSON.stringify(duplicate),1,'now',null);let d=await f.bank.loadBankData();await f.bank.saveBankAnnotation(scope,'tx2',{...d.annotations.tx2,personId:'bea',personName:'Bea',seriesOwnerId:'bea',shares:d.annotations.tx2.shares.map(s=>({...s,person:'Bea'}))});await f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana'});d=await f.bank.loadBankData();for(const id of ['tx1','tx2']){assert.equal(d.annotations[id].personId,'ana');assert.equal(d.annotations[id].shares.length,1);assert.equal(d.annotations[id].shares[0].person,'Ana');}const decisions=(await f.controls.listControls()).filter(c=>c.type==='purchase-series');assert.ok(decisions.every(c=>c.ownerId==='ana'));assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).conflicts.length,0);}finally{f.db.close();}
});

test('parcelas já classificadas acompanham o vencimento oficial de cada mês sem congelar o dia inicial',async()=>{
 const f=fixture();try{
  const b1={...bill(1),date:'2026-09-13'},b2={...bill(2),date:'2026-10-13'};
  await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2),b1,b2]));await f.controls.saveControl(scope,person);await f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana',dueDay:13});
  let data=await f.bank.loadBankData();const ids=[data.annotations.tx1.shares[0].id,data.annotations.tx2.shares[0].id];assert.equal(data.annotations.tx2.shares[0].dueDate,'2026-10-13');
  await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2),b1,{...b2,date:'2026-10-15'}]));await f.purchases.applySavedPurchaseSeries(scope);data=await f.bank.loadBankData();
  assert.equal(data.annotations.tx1.shares[0].dueDate,'2026-09-13');assert.equal(data.annotations.tx2.shares[0].dueDate,'2026-10-15');assert.deepEqual([data.annotations.tx1.shares[0].id,data.annotations.tx2.shares[0].id],ids);assert.equal(data.annotations.tx2.shares[0].amount,'100,00');assert.equal((await f.purchases.applySavedPurchaseSeries(scope)).changed,0);
 }finally{f.db.close();}
});
test('reparo de parcelas antigas conserva rateios, vínculos, pagamentos e dados bancários',async()=>{
 const f=fixture();try{
  await f.bank.applyBankSnapshot(snapshot([tx(2),{...bill(2),date:'2026-10-28'}]));const note={nature:'Despesa',categoryId:'sites',notes:'Conferido',links:{receipt:'paid'},shares:[{id:'s1',person:'Ana',amount:'50,00',dueDate:'2026-10-13'},{id:'s2',person:'Bea',amount:'50,00',dueDate:'2026-10-13'}]};await f.bank.saveBankAnnotation(scope,'tx2',note);
  const receipt={id:'receipt',type:'reconciliations',controlId:'share:tx2:s1',bankRecordId:'pix',direction:'receipt',amountCents:4000,date:'2026-10-20'};f.db.prepare('INSERT INTO entity_records VALUES(?,?,?,?,?,?)').run('reconciliations',receipt.id,JSON.stringify(receipt),1,'now',null);
  const before=await f.bank.loadBankData(),controlsBefore=JSON.stringify(await f.controls.listControls());assert.equal((await f.purchases.alignInstallmentDueDates(scope)).changed,1);const after=await f.bank.loadBankData();
  assert.equal(JSON.stringify(after.records),JSON.stringify(before.records));assert.equal(JSON.stringify(await f.controls.listControls()),controlsBefore);assert.deepEqual(after.annotations.tx2,{...note,shares:note.shares.map(s=>({...s,dueDate:'2026-10-28'}))});const obligation=f.controls.deriveObligations(after,await f.controls.listControls()).find(c=>c.id==='share:tx2:s1');assert.equal(f.controls.controlBalance(obligation,[receipt]).pendingCents,1000);assert.equal((await f.purchases.alignInstallmentDueDates(scope)).changed,0);
 }finally{f.db.close();}
});
test('classificar a âncora não restaura vencimento antigo sobre a fatura do mês',async()=>{
 const f=fixture();try{
  await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2),bill(1),{...bill(2),date:'2026-10-20'}]));const share={id:'custom-share',person:'Ana',amount:'100,00',dueDate:'2026-10-13'};
  await f.purchases.savePurchaseSeries(scope,'tx2',{classification:{nature:'Despesa',categoryId:'sites'},anchorAnnotation:{notes:'Minha nota',shares:[share]}});const data=await f.bank.loadBankData();assert.deepEqual(data.annotations.tx2.shares,[{...share,dueDate:'2026-10-20'}]);assert.equal(data.annotations.tx2.notes,'Minha nota');
 }finally{f.db.close();}
});
test('sem fatura mensal não inventa reparo; respeita data específica e ambiguidade do cartão',async()=>{
 const f=fixture();try{
  await f.bank.applyBankSnapshot(snapshot([tx(2),bill(1)]));const note={shares:[{id:'manual',person:'Ana',amount:'100,00',dueDate:'2026-10-13'}]};await f.bank.saveBankAnnotation(scope,'tx2',note);assert.equal((await f.purchases.alignInstallmentDueDates(scope)).changed,0);
  await f.controls.saveControl(scope,{id:'settings',type:'card-settings',name:'Cartão',accountId:'card',itemId:'item',dueDay:13,'dueDate:2026-10':'2026-10-22'});assert.equal((await f.purchases.alignInstallmentDueDates(scope)).changed,1);assert.equal((await f.bank.loadBankData()).annotations.tx2.shares[0].dueDate,'2026-10-22');
 }finally{f.db.close();}
});


test('lembrete usa quitação oficial, crédito no cartão e conciliação sem somar fontes duplicadas',()=>{
 const f=fixture();try{
  const {notificationPlan}=f.load('src/data/notificationPlan.ts'),preferences=f.prefs.defaultAppPreferences();preferences.notifications={enabled:true,types:['invoice-due']};
  const now=new Date('2026-10-01T12:00:00Z'),b=bill(2),run=(records,controls=[])=>notificationPlan(snapshot(records),controls,preferences,now);
  assert.equal(run([b]).length,1);
  assert.equal(run([{...b,metadata:{payments:[{id:'official',date:'2026-10-01',amountCents:10000}]}}]).length,0);
  const credit={...tx(2),id:'credit',date:'2026-10-01',amountCents:10000,name:'PAGAMENTO FATURA',metadata:{card:true,billId:b.id,operationType:'CREDIT_CARD_PAYMENT'}};
  assert.equal(run([b,credit]).length,0);
  const manual={id:'manual',type:'reconciliations',controlId:b.id,date:'2026-10-01',direction:'bill-payment',amountCents:10000};assert.equal(run([b],[manual]).length,0);
  const half={...b,metadata:{payments:[{id:'half',date:'2026-10-01',amountCents:5000}]}};
  assert.equal(run([half,{...credit,amountCents:5000}],[{...manual,amountCents:5000}]).length,1);
  assert.equal(run([{...b,metadata:{payments:[{date:'2026-10-02',amountCents:10000}]}}]).length,1);
  assert.equal(run([b,{...credit,itemId:'other-bank'}]).length,1);
  assert.equal(run([b,{...credit,metadata:{...credit.metadata,operationType:'REFUND'}}]).length,1);
  const midnight=new Date('2026-10-02T01:00:00Z');assert.equal(notificationPlan(snapshot([{...b,metadata:{payments:[{date:'2026-10-02',amountCents:10000}]}}]),[],preferences,midnight).length,1);
 }finally{f.db.close();}
});


test('arredondamento inicial mantém uma compra única, previsão única e decisão da série ao editar parcela seguinte',async()=>{
 const f=fixture();try{
  const first=tx(1,{name:'JIM.COM NETTO VENA01/12',amountCents:-66674,date:'2026-10-24',invoiceMonth:'2026-11',metadata:{card:true,installmentNumber:1,totalInstallments:12,purchaseDate:'2026-10-24T12:00:00Z'}}),second={...first,id:'tx2',name:'JIM.COM NETTO VENA02/12',amountCents:-66666,date:'2026-12-03',invoiceMonth:'2026-12',status:'PENDING',metadata:{...first.metadata,installmentNumber:2}},b={...bill(2),id:'b-nov',date:'2026-11-13'};
  await f.bank.applyBankSnapshot(snapshot([first,second,b]));await f.controls.saveControl(scope,person);const rowsBefore=JSON.stringify((await f.bank.loadBankData()).records);
  const a=await f.purchases.savePurchaseSeries(scope,'tx1',{ownerId:'ana',classification:{nature:'Despesa',categoryId:'shopping'},label:'Compra de móveis'});let d=await f.bank.loadBankData();assert.equal(d.annotations.tx2.categoryId,'shopping');assert.equal(d.annotations.tx2.shares[0].amount,'666,66');assert.equal(d.annotations.tx2.shares[0].dueDate,'2026-12-14');assert.equal(JSON.stringify(d.records),rowsBefore);
  const bSave=await f.purchases.savePurchaseSeries(scope,'tx2',{label:'Móveis'});assert.equal(bSave.series.id,a.series.id);assert.equal((await f.controls.listControls()).filter(c=>c.type==='purchase-series').length,1);
  d=await f.bank.loadBankData();const family=f.load('src/data/purchaseSeries.ts').installmentPurchases(d);assert.equal(family.length,1);assert.equal(family[0].importedInstallments,2);assert.equal(family[0].importedTotalCents,133340);
  const forecast=f.load('src/data/installmentForecast.ts').installmentForecastRows;assert.equal(forecast(d,'2026-12').length,0);const jan=forecast(d,'2027-01');assert.equal(jan.length,1);assert.equal(jan[0].metadata.installmentNumber,3);assert.equal(jan[0].amountCents,-66666);
 }finally{f.db.close();}
});


test('vencimento usa dia-base e próximo dia de semana sem reaproveitar exceção histórica',()=>{
 const f=fixture();try{
 const {cardBillingDates}=f.load('src/data/cardInvoice.ts'),{installmentDueDate}=f.load('src/data/installmentContinuity.ts');
 const card={...tx(1),id:'card-record',kind:'card',metadata:{dueDate:'2026-10-13'}},bills=['2026-07-10','2026-08-10','2026-09-10','2026-10-13'].map((date,i)=>({...bill(1),id:'bill-'+i,date,metadata:{closingDate:date.slice(0,7)+'-03'}})),d=snapshot([card,...bills]);
 assert.equal(cardBillingDates(d,card,'2026-10').due,'2026-10-13');assert.equal(cardBillingDates(d,card,'2026-11').due,'2026-11-10');assert.equal(cardBillingDates(d,card,'2026-12').due,'2026-12-10');assert.equal(installmentDueDate(tx(1),'2026-11',d,[],true),'2026-11-10');
 assert.equal(cardBillingDates(d,card,'2026-11',[{id:'s',type:'card-settings',accountId:'card',dueDay:15}]).due,'2026-11-16');
 assert.equal(cardBillingDates(d,card,'2026-11',[{id:'s',type:'card-settings',accountId:'card','dueDate:2026-11':'2026-11-12'}]).due,'2026-11-12');
 const official={...bill(1),id:'official',date:'2026-11-16'};assert.equal(cardBillingDates(snapshot([...d.records,official]),card,'2026-11').due,'2026-11-16');
 const onlyLast=snapshot([card,bills[3]]);assert.equal(cardBillingDates(onlyLast,card,'2026-11').due,'2026-11-10');
 const current={...card,metadata:{dueDate:'2026-11-17'}};assert.equal(cardBillingDates(snapshot([current,...bills]),current,'2026-11').due,'2026-11-17');
 }finally{f.db.close();}
});


test('parcelas projetadas usam dia-base do cartão, sem copiar dia excepcional da participação',()=>{
 const f=fixture();try{
  const card={...tx(1),id:'card-record',kind:'card',metadata:{dueDate:'2026-10-13'}},part=tx(1,{invoiceMonth:'2026-11',metadata:{...tx(1).metadata,totalInstallments:12}}),d={...snapshot([card,part]),annotations:{[part.id]:{nature:'Despesa',shares:[{id:'kept',person:'Ana',amount:'100,00',dueDate:'2026-11-13'}]}}};
  const forecast=f.load('src/data/installmentForecast.ts').withInstallmentForecast(d,['2027-01'],[{id:'s',type:'card-settings',accountId:'card',dueDay:10}]);
  const projected=forecast.records.find(r=>r.metadata.installmentProjection);assert.ok(projected);assert.equal(forecast.annotations[projected.id].shares[0].dueDate,'2027-01-11');assert.equal(d.annotations[part.id].shares[0].dueDate,'2026-11-13');
 }finally{f.db.close();}
});

test('dia-base é salvo uma vez e parcelas acompanham previsão e posterior data bancária',async()=>{
 const f=fixture();try{
  const card={...tx(1),id:'card-record',kind:'card',metadata:{dueDate:'2026-10-13'}},part=tx(1,{invoiceMonth:'2027-01'}),history=['2026-08-10','2026-09-10','2026-10-13'].map((date,i)=>({...bill(1),id:'history-'+i,date}));
  await f.bank.applyBankSnapshot(snapshot([card,part,...history]));await f.controls.saveControl(scope,person);
  await f.bank.saveBankAnnotation(scope,part.id,{nature:'Despesa',categoryId:'shopping',shares:[{id:'kept',person:'Ana',amount:'100,00',dueDate:'2027-01-13'}]});
  const recordsBefore=JSON.stringify((await f.bank.loadBankData()).records);
  const first=await f.purchases.alignInstallmentDueDates(scope);assert.equal(first.changed,2);
  let controls=await f.controls.listControls();assert.equal(controls.find(c=>c.type==='card-settings').dueDay,10);
  let current=await f.bank.loadBankData();assert.equal(current.annotations[part.id].shares[0].dueDate,'2027-01-11');assert.equal(JSON.stringify(current.records),recordsBefore);
  assert.equal((await f.purchases.alignInstallmentDueDates(scope)).changed,0);
  const official={...bill(1),id:'bank-jan',date:'2027-01-12'};await f.bank.applyBankSnapshot(snapshot([card,part,...history,official]));await f.purchases.alignInstallmentDueDates(scope);
  current=await f.bank.loadBankData();assert.equal(current.annotations[part.id].shares[0].dueDate,'2027-01-12');assert.equal(current.annotations[part.id].shares[0].id,'kept');assert.equal(current.annotations[part.id].shares[0].amount,'100,00');
  controls=await f.controls.listControls();assert.equal(controls.find(c=>c.type==='card-settings').dueDay,10);
 }finally{f.db.close();}
});

test('novos lançamentos persistem por importação sem confundir atualização com inserção ou alterar valores',async()=>{
 const f=fixture();try{const state=f.load('src/data/insightState.ts');await seed(f);let current=await state.loadInsightState(scope);assert.deepEqual(current.ids.sort(),['tx1','tx2']);await state.saveInsightState(scope,{reviewed:true});const before=JSON.stringify((await f.bank.loadBankData()).records);await f.bank.applyBankSnapshot(snapshot([tx(1),tx(2)]));assert.equal((await state.loadInsightState(scope)).reviewed,true);assert.equal(JSON.stringify((await f.bank.loadBankData()).records),before);await f.bank.applyBankSnapshot(snapshot([tx(3)]));current=await state.loadInsightState(scope);assert.deepEqual(current.ids,['tx3']);assert.equal(current.reviewed,false);await assert.rejects(state.saveInsightState('other',{reviewed:true}),/conexão/);}finally{f.db.close();}
});
test('recorrência usa vínculo explícito para substituir previsão sem criar despesa ou confirmar por valor parecido',()=>{
 const f=fixture();try{const {recurringMonth}=f.load('src/data/recurringInsights.ts'),r=tx(1,{accountId:'account',date:'2026-10-20',amountCents:-12600}),c={id:'light',type:'recurrences',name:'Luz',accountId:'account',day:31,amountCents:12000,variable:true},d=snapshot([r]),before=JSON.stringify(d);assert.equal(recurringMonth(d,[c],'2026-10')[0].confirmed,false);const linked={...c,linkedTransactions:{'2026-10':r.id}};assert.equal(recurringMonth(d,[linked],'2026-10')[0].value,12600);assert.equal(recurringMonth(d,[linked],'2026-11')[0].confirmed,false);assert.equal(recurringMonth(d,[linked],'2026-11')[0].date,'2026-11-30');assert.equal(recurringMonth(d,[{...linked,accountId:'foreign'}],'2026-10')[0].confirmed,false);assert.equal(JSON.stringify(d),before);}finally{f.db.close();}
});
test('alertas reutilizam limite e gasto próprio, exigem ativação por categoria e limitam a repetição',()=>{
 const f=fixture();try{const {controlAlertEvents}=f.load('src/data/controlAlerts.ts'),categories=f.load('src/data/settingsModel.ts').resolveCategories([]),category=categories.find(c=>c.name==='Delivery'),r=tx(2,{amountCents:-9000}),d={...snapshot([r]),annotations:{tx2:{nature:'Despesa',categoryId:category.id}}},setting={id:'monthly-limits',type:'settings',name:'Limites',limits:{Delivery:'100,00'},controlAlerts:{Delivery:true},alertThreshold:'80%'};const events=controlAlertEvents(d,[setting],'2026-10-28');assert.equal(events.length,1);assert.equal(events[0].percent,90);assert.equal(controlAlertEvents(d,[{...setting,controlAlerts:{}}],'2026-10-28').length,0);assert.equal(controlAlertEvents({...d,annotations:{tx2:{...d.annotations.tx2,shares:[{person:'Ana',amount:'90,00',dueDate:'2026-10-10'}]}}},[setting],'2026-10-28').length,0);assert.notEqual(events[0].key,controlAlertEvents(d,[setting],'2026-10-29')[0].key);const band={...setting,alertFrequency:'Só quando mudar de faixa'};assert.equal(controlAlertEvents(d,[band],'2026-10-28')[0].key,controlAlertEvents(d,[band],'2026-10-29')[0].key);}finally{f.db.close();}
});



