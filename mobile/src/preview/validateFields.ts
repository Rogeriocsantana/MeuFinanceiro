import type {FieldSpec} from './parityForms';
import {parseMoneyCents} from './formValues';
export function validateFields(fields:FieldSpec[],values:Record<string,string>){
 for(const field of fields){
  const value=values[field.label]??field.value??field.options?.[0]??'';
  if(field.required&&(!value.trim()||value==='Selecione'))return 'Preencha '+field.label+'.';
  if(!value||field.type==='check')continue;
  if(field.type==='money'&&!field.label.includes('(%)')&&!Number.isFinite(parseMoneyCents(value)))return 'Informe um valor válido em '+field.label+'.';
  if(field.type==='number'){
   const number=Number(value);
   if(!Number.isInteger(number)||(field.min!==undefined&&number<field.min)||(field.max!==undefined&&number>field.max))return 'Confira '+field.label+'.';
  }
  if(field.type==='date'){
   const date=new Date(value+'T12:00:00');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||(field.minDate&&value<field.minDate)||(field.maxDate&&value>field.maxDate))return 'Confira '+field.label+'.';
  }
  if(field.maxLength&&value.length>field.maxLength)return 'Confira o tamanho de '+field.label+'.';
 }
 return '';
}
