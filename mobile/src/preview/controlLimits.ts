import {parseMoneyCents} from './formValues';
type Category={key:string;name:string;parentKey?:string};
export function validateControlLimits(values:Record<string,string>,categories:readonly Category[]):string {
 for(const [name,value] of Object.entries(values)){
  const cents=parseMoneyCents(value);
  if(!Number.isFinite(cents)||cents<=0||cents>1000000000)return 'Informe um limite mensal válido para '+name+'.';
  const category=categories.find(c=>c.name===name),parent=categories.find(c=>c.key===category?.parentKey);
  if(parent&&values[parent.name]!==undefined&&cents>parseMoneyCents(values[parent.name]!))return 'O limite de '+name+' não pode ser maior que o de '+parent.name+'.';
 }
 return '';
}
