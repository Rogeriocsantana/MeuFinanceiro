import React from 'react';
import {useTheme} from './Theme';
import {useLoading} from './Loading';
import {TextInput} from './ThemePrimitives';
import {C,u} from './ui';
import type {FieldSpec} from './parityForms';
import {maskMoneyValue} from './formValues';

export default function PreviewInput({field,value,onChange,autoFocus=false}:{autoFocus?:boolean;field:FieldSpec;value:string;onChange:(value:string)=>void}){
 const {dark}=useTheme(),{action}=useLoading();
 if(field.type==='date'||field.type==='number')return React.createElement('input',{'aria-label':field.label,autoFocus,disabled:field.disabled||!!action,type:field.type,value:field.type==='date'?(/^\d{4}-\d{2}-\d{2}$/.test(value)?value:''):value,min:field.type==='date'?field.minDate:field.min,max:field.type==='date'?field.maxDate:field.max,step:field.type==='number'?1:undefined,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChange(e.target.value),required:field.required,style:{boxSizing:'border-box',width:'100%',minHeight:46,border:dark?'1px solid #3a3a3a':'1px solid #e8ecf3',borderRadius:12,padding:12,fontSize:14,color:dark?'#eef5fb':C.ink,backgroundColor:dark?'#292929':'#fff',colorScheme:dark?'dark':'light',fontFamily:'inherit'}});
 return <TextInput autoFocus={autoFocus} accessibilityLabel={field.label} editable={!field.disabled} accessibilityState={{disabled:!!field.disabled}} value={value} onChangeText={text=>onChange(field.type==='money'&&!field.label.includes('(%)')?maskMoneyValue(text):text)} onBlur={()=>{if(field.type==='money'&&!field.label.includes('(%)'))onChange(value.trim()?maskMoneyValue(value,true):'');}} placeholder={field.placeholder??(field.type==='money'?'0,00':undefined)} secureTextEntry={field.type==='password'} multiline={field.type==='multiline'} inputMode={field.type==='money'?'decimal':'text'} maxLength={field.maxLength} style={[u.input,field.compact&&{height:38,paddingVertical:8,paddingHorizontal:9,minWidth:0,fontSize:12},field.type==='multiline'&&{minHeight:90,textAlignVertical:'top'}]}/>;
}
