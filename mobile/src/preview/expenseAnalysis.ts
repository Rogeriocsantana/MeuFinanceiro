import type {AnalysisGroup} from './AnalysisScreen';

const referenceColors:Record<string,string>={casa:'#205dff',alimentacao:'#ed6862',compras:'#2faf8a',transporte:'#edb83d',pessoal:'#edb83d',pagamentos:'#a5a1df'};
export function expenseCategoryColor(name:string){
 const normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 if(referenceColors[normalized])return referenceColors[normalized]!;
 const palette=['#205dff','#ed6862','#2faf8a','#edb83d','#a5a1df'];
 let hash=0;for(const char of normalized)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
 return palette[hash%palette.length]!;
}
export function expenseComparison(amount:number,previous:number){const difference=amount-previous;return {difference,absolute:Math.abs(difference),direction:difference<0?'down':difference>0?'up':'equal',percentage:previous?difference/Math.abs(previous)*100:null};}

/** Keep signed expenses through grouping. Only the chart renderer clamps slices. */
export function groupExpenseCategories(rows:{categoryId:string;amountCents:number}[],categories:{id:string;name:string;parentKey?:string}[]):AnalysisGroup[]{
 const groups:AnalysisGroup[]=[];
 for(const row of rows){
  const category=categories.find(c=>c.id===row.categoryId),parent=categories.find(c=>c.id===category?.parentKey),name=parent?.name||category?.name||'A classificar';
  let group=groups.find(g=>g.name===name);
  if(!group){group={name,amount:0,color:expenseCategoryColor(name),children:[]};groups.push(group);}
  group.amount+=row.amountCents;
  if(parent&&category){const child=group.children.find(([name])=>name===category.name);if(child)child[1]+=row.amountCents;else group.children.push([category.name,row.amountCents]);}
 }
 return groups;
}
