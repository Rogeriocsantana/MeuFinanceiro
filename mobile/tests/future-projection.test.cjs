const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/data/futureProjection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m);const {futureProjection,defaultFutureOptions}=m.exports;const base={cash:100000,reserves:20000,investments:30000,loanPrincipal:10000,loanInterest:1000,purchases:5000},options=patch=>({...defaultFutureOptions,...patch}),project=(events=[],patch={},target='2027-01-31')=>futureProjection(base,events,'2027-01-01',target,options(patch));
test('aporte é transferência, sem criar patrimônio e sem somar posições duas vezes',()=>{const r=project([],{reserveContribution:1000,investmentContribution:2000});assert.equal(r.transfers,3000);assert.equal(r.cash,97000);assert.equal(r.reserves,21000);assert.equal(r.investments,32000);assert.equal(r.total,r.initialTotal);assert.equal(r.growth,0);});
test('principal volta ao cofrinho e reembolso volta às contas; juros aumentam o total',()=>{const loan={id:'l',name:'Empréstimo',kind:'loan',date:'2027-01-10',amountCents:11000,principalCents:10000},purchase={id:'p',name:'Compra',kind:'purchase',date:'2027-01-10',amountCents:5000},events=[loan,purchase,loan],before=JSON.stringify(events),r=project(events);assert.equal(r.incoming,5000);assert.equal(r.reserves,31000);assert.equal(r.loanPrincipal,0);assert.equal(r.loanInterest,0);assert.equal(r.purchases,0);assert.equal(r.total,r.initialTotal+1000);assert.equal(JSON.stringify(events),before);});
test('recebimento parcial hipotético preserva o principal restante e os atrasados são opcionais',()=>{const e={id:'late',name:'Atrasado',kind:'loan',date:'2026-12-10',amountCents:11000,principalCents:10000};assert.equal(project([e]).incoming,0);const r=project([e],{overdue:true,collectionPercent:50});assert.equal(r.loanReceipts,5500);assert.equal(r.loanPrincipal,5000);assert.equal(r.loanInterest,500);assert.equal(project([e],{overdue:true,loans:false}).incoming,0);});
test('rendimento é hipótese separada, com zero por padrão e contribuição ao fim do mês',()=>{assert.equal(project().growth,0);const r=project([],{investmentRate:1,investmentContribution:1000});assert.ok(r.investments>31290&&r.investments<31310);assert.equal(r.transfers,1000);assert.equal(project([],{investments:false,investmentContribution:1000}).transfers,0);});
test('faturas vencidas pendentes reduzem contas e eventos fora da data são excluídos',()=>{const events=[{id:'bill',name:'Fatura',kind:'bill',date:'2026-12-10',amountCents:2000},{id:'future',name:'Depois',kind:'income',date:'2027-02-01',amountCents:5000}];assert.equal(project(events).outgoing,2000);assert.equal(project(events).incoming,0);assert.equal(project(events,{bills:false}).outgoing,0);});
test('dados e cenários inválidos são rejeitados sem modificar posições',()=>{const before=JSON.stringify(base);assert.throws(()=>project([],{},'2026-12-31'));assert.throws(()=>project([],{collectionPercent:101}));assert.throws(()=>project([],{reserveRate:-100}));assert.throws(()=>project([],{extraExpense:-1}));assert.throws(()=>project([],{},'2027-02-31'));assert.equal(JSON.stringify(base),before);});
test('parcelas vão para o cofrinho e reembolsos compensam a fatura nas contas',()=>{
 const date='2027-01-10';
 const r=project([
  {id:'loan',name:'Parcela',date,kind:'loan',amountCents:11000,principalCents:10000},
  {id:'purchase',name:'Reembolso',date,kind:'purchase',amountCents:5000},
  {id:'bill',name:'Fatura',date,kind:'bill',amountCents:8000},
 ]);
 assert.equal(r.cash,97000);
 assert.equal(r.reserves,31000);
 assert.equal(r.loanPrincipalReceived,10000);
 assert.equal(r.loanInterestReceived,1000);
 assert.equal(r.growth,0);
 assert.equal(r.total,r.initialTotal-7000);
});
