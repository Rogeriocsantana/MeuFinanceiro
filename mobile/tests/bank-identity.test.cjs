const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/data/bankIdentity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m);const {protectBankIdentity:protect}=m.exports;
const old={id:'old',kind:'transaction',itemId:'connection',accountId:'card',name:'Loja',currency:'BRL',amountCents:-10000,date:'2026-10-24',invoiceMonth:'2026-11',status:'POSTED',metadata:{card:true,sourceId:'provider-old',installmentNumber:1,totalInstallments:12}};
const snapshot=records=>({scope:'owner',records,syncedAt:'2026-10-29T12:00:00Z',warnings:[]}),notes=new Map([['old',{shares:[{id:'share',amount:'100,00',person:'Ana',dueDate:'2026-11-10'}]}]]);
test('proteção não transfere quitação por semelhança nem cruza cartão ou conexão',()=>{
 const incoming={...old,id:'new',metadata:{...old.metadata,sourceId:'provider-new'}};
 assert.throws(()=>protect(snapshot([incoming]),[old],notes),/identificador/);
 for(const patch of [{accountId:'other'},{itemId:'other'},{invoiceMonth:'2026-12',metadata:{...incoming.metadata,installmentNumber:2}}])assert.equal(protect(snapshot([{...incoming,...patch}]),[old],notes).records[0].id,'new');
 assert.equal(protect(snapshot([incoming]),[old],new Map()).records[0].id,'new');
 assert.throws(()=>protect(snapshot([incoming]),[old],new Map(),[{type:'reconciliations',controlId:'share:old:share'}]),/identificador/);
});
test('referência estável só resolve um lançamento e preserva aliases sem alterar a entrada',()=>{
 const incoming={...old,id:'new'},before=JSON.stringify([old,incoming]);const result=protect(snapshot([incoming]),[old],notes);assert.equal(result.records[0].id,'old');assert.deepEqual(result.records[0].metadata.sourceRecordAliases,['new']);assert.equal(JSON.stringify([old,incoming]),before);
 assert.throws(()=>protect(snapshot([incoming]),[old,{...old,id:'duplicate'}],new Map([...notes,['duplicate',{}]])),/identificadores/);
 assert.throws(()=>protect(snapshot([old,incoming]),[old],notes),/dois identificadores/);
});

