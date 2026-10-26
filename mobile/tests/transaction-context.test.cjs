const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function load(file){const m={exports:{}};new Function('require','exports','module',ts.transpileModule(fs.readFileSync('src/data/'+file+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='./bankOverview'?load('bankOverview'):require(name),m.exports,m);return m.exports;}
const {matchesTransactionContext:matches}=load('transactionContext');
test('movimentos da pessoa incluem envio e recebimento conciliados sem anotação e isolam outras pessoas',()=>{
 const tx={id:'pix',accountId:'a',name:'Transferência bancária',metadata:{}},data={annotations:{}},loan={id:'loan',type:'loans',person:'Miguel'};
 for(const key of ['bankRecordId','sourceBankRecordId']){
  const controls=[loan,{id:'receipt',type:'reconciliations',controlId:'loan',[key]:'pix'}];
  assert.equal(matches(tx,'Miguel',data,controls),true);
  assert.equal(matches(tx,'Clara',data,controls),false);
  assert.equal(matches({...tx,id:'unrelated'},'Miguel',data,controls),false);
 }
 assert.equal(matches(tx,'Miguel',{annotations:{pix:{controlId:'loan'}}},[loan]),true);
 assert.equal(matches(tx,'Miguel',data,[loan,{id:'orphan',type:'reconciliations',controlId:'missing',bankRecordId:'pix'}]),false);
});
test('contexto do cofrinho preserva conta e nome completo, inclusive dois pontos',()=>{
 const data={annotations:{}},tx={id:'t',accountId:'a',name:'Dinheiro reservado Casa: nova',metadata:{}};
 assert.equal(matches(tx,'Cofrinho:a:Casa: nova',data,[]),true);
 assert.equal(matches(tx,'Cofrinho:b:Casa: nova',data,[]),false);
 assert.equal(matches(tx,'Cofrinho:a:Outro',data,[]),false);
 assert.equal(matches(tx,'Cofrinho',data,[]),true);
});
test('transferência classificada em meta também aparece, compra comum não',()=>{
 const data={annotations:{t:{controlId:'goal'}}},tx={id:'t',accountId:'a',name:'Transferência',metadata:{}},controls=[{id:'goal',type:'goals',name:'Casa'}];
 assert.equal(matches(tx,'Cofrinho:a:Casa',data,controls),true);
 assert.equal(matches({...tx,id:'other'},'Cofrinho',data,controls),false);
});
