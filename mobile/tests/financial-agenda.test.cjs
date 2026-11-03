const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync('src/data/financialAgenda.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load({bill,recurrences=[],parts=[],pending=0}){const m={exports:{}};new Function('require','module','exports',source)(name=>({
 './cardInvoice':{cardInvoice:()=>({bill,totalCents:10000}),cardBillingDates:()=>({due:'2026-11-10'}),cardBillPaymentSummary:()=>({pendingCents:pending})},
 './localControls':{deriveObligations:(_d,c)=>c,loanLedger:()=>parts,controlBalance:c=>({pendingCents:c.pending,totalCents:c.amountCents})},
 './recurringInsights':{recurringMonth:()=>recurrences},
 }[name]||assert.fail('unexpected dependency '+name)),m,m.exports);return m.exports.financialAgenda;}
const data={scope:'test',annotations:{},records:[{id:'card',kind:'card',accountId:'card',name:'Cartão',status:'ACTIVE'}]};
test('agenda não soma novamente recorrência do cartão, exclui quitados e conserva pagamentos parciais',()=>{
 const calculate=load({bill:{status:'IMPORTED'},pending:6000,recurrences:[{id:'card-rec',accountId:'card',name:'Assinatura',date:'2026-11-10',value:3000,confirmed:false},{id:'energy',accountId:'account',name:'Energia',date:'2026-11-15',value:2000,confirmed:false,variable:true},{id:'paid-rec',accountId:'account',name:'Internet',date:'2026-11-01',value:1000,confirmed:true}],parts:[{id:'part1',dueDate:'2026-11-10',index:1,amountCents:5000,pending:2000},{id:'part2',dueDate:'2026-11-11',index:2,amountCents:5000,pending:0},{id:'part3',dueDate:'2026-12-10',index:3,amountCents:5000,pending:5000}]});
 const controls=[{id:'loan',type:'loans',name:'Contrato',person:'Clara'},{id:'buy',type:'card-shares',name:'Compra',person:'Clara',dueDate:'2026-11-10',amountCents:3000,pending:1000},{id:'paidbuy',type:'card-shares',name:'Quitada',dueDate:'2026-11-10',amountCents:4000,pending:0}],before=JSON.stringify([data,controls]),result=calculate(data,controls,'2026-11');
 assert.equal(result.pay,8000);assert.equal(result.receive,3000);assert.equal(result.rows.find(r=>r.id==='recurring:card-rec').included,false);assert.equal(result.rows.find(r=>r.id==='loan:loan:part2').resolved,true);assert.equal(result.rows.find(r=>r.id==='purchase:paidbuy').resolved,true);assert(!result.rows.some(r=>r.date.startsWith('2026-12')));assert.equal(JSON.stringify([data,controls]),before);
});
test('fatura informada como paga permanece resolvida mesmo sem nova vinculação manual',()=>{
 const result=load({bill:{status:'PAID'},pending:10000})(data,[],'2026-11');assert.equal(result.pay,0);assert.equal(result.rows[0].resolved,true);assert.equal(result.rows[0].amount,10000);
});
