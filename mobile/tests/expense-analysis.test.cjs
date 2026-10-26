const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/preview/expenseAnalysis.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({}),mod,mod.exports);
test('signed refunds are grouped before clamping pie slices; totals and classifications remain intact',()=>{
 const categories=[{id:'food',name:'Alimentação'},{id:'market',name:'Mercado',parentKey:'food'},{id:'delivery',name:'Delivery',parentKey:'food'},{id:'house',name:'Casa'}];
 const rows=[{categoryId:'market',amountCents:10000},{categoryId:'market',amountCents:-2000},{categoryId:'delivery',amountCents:-3000},{categoryId:'house',amountCents:-1000}];
 const before=JSON.stringify({categories,rows}),groups=mod.exports.groupExpenseCategories(rows,categories);
 assert.equal(groups[0].amount,5000);assert.deepEqual(groups[0].children,[['Mercado',8000],['Delivery',-3000]]);
 assert.equal(groups.reduce((n,g)=>n+g.amount,0),4000);
 assert.deepEqual(groups.map(g=>Math.max(0,g.amount)),[5000,0]);
 assert.equal(JSON.stringify({categories,rows}),before);
});
test('reference category colors stay fixed across row order and new categories',()=>{
 const categories=[{id:'house',name:'Casa'},{id:'food',name:'Alimentação'},{id:'custom',name:'Animais'}],rows=categories.map(c=>({categoryId:c.id,amountCents:100}));
 const first=mod.exports.groupExpenseCategories(rows,categories),second=mod.exports.groupExpenseCategories([...rows].reverse(),categories);
 const colors=groups=>Object.fromEntries(groups.map(g=>[g.name,g.color]));
 assert.deepEqual(colors(first),colors(second));assert.equal(colors(first).Casa,'#205dff');assert.equal(colors(first)['Alimentação'],'#ed6862');
 assert.equal(mod.exports.expenseCategoryColor('ALIMENTAÇÃO'),mod.exports.expenseCategoryColor('Alimentação'));
});
test('monthly comparison reports reduction, increase and an empty previous period without inventing percentage',()=>{
 assert.deepEqual(mod.exports.expenseComparison(8000,10000),{difference:-2000,absolute:2000,direction:'down',percentage:-20});
 assert.deepEqual(mod.exports.expenseComparison(2000,0),{difference:2000,absolute:2000,direction:'up',percentage:null});
 assert.deepEqual(mod.exports.expenseComparison(0,0),{difference:0,absolute:0,direction:'equal',percentage:null});
});
