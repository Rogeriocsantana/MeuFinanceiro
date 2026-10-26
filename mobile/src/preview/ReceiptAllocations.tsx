import {Text} from './Typography';
import React,{useState} from 'react';
import {TouchableOpacity,View} from './ThemePrimitives';
import PreviewInput from './PreviewInput';
import {C,Icon,money,u} from './ui';
import {parseMoneyCents} from './formValues';

export type ReceiptObligation={id:string;name:string;date:string;referenceMonth?:string;balanceCents:number};
export type ReceiptAllocation={id:string;checked:boolean;amount:string};
export default function ReceiptAllocations({items,amountCents,value,onChange,limitToReceipt=true}:{items:ReceiptObligation[];amountCents:number;limitToReceipt?:boolean;value?:ReceiptAllocation[];onChange?:(rows:ReceiptAllocation[])=>void}){
 const [local,setLocal]=useState<ReceiptAllocation[]>([]),rows=value??local;
 const orderedItems=[...items].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'pt-BR',{numeric:true})||a.id.localeCompare(b.id));
 const initialAmount=(item:ReceiptObligation)=>((limitToReceipt?Math.min(item.balanceCents,amountCents):item.balanceCents)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const update=(id:string,patch:Partial<ReceiptAllocation>)=>{const item=items.find(i=>i.id===id)!;const prev=rows.find(r=>r.id===id)||{id,checked:false,amount:initialAmount(item)};const next=[...rows.filter(r=>r.id!==id),{...prev,...patch}];if(onChange)onChange(next);else setLocal(next);};
 const total=rows.filter(r=>r.checked&&items.some(i=>i.id===r.id)).reduce((sum,row)=>sum+(parseMoneyCents(row.amount)||0),0);
 return <View style={{gap:14}}><Text style={u.h2}>O que foi pago?</Text>{orderedItems.length?orderedItems.map(item=>{const row=rows.find(r=>r.id===item.id),checked=!!row?.checked;return <View key={item.id} style={{flexDirection:'row',gap:7,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.line,alignItems:'center'}}><TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={'Selecionar '+item.name} accessibilityState={{checked}} onPress={()=>update(item.id,{checked:!checked})} style={{width:24,paddingVertical:8}}><View style={[u.check,{width:16,height:16,borderRadius:3},checked&&{backgroundColor:C.blue,borderColor:C.blue}]}>{checked&&<Icon name="check" color="#fff" size={12}/>}</View></TouchableOpacity><View style={{flex:1,minWidth:0,gap:5}}><Text style={[u.rowTitle,{fontSize:12}]}>{item.name}</Text>{!!item.referenceMonth&&<Text style={[u.small,{fontSize:10,fontWeight:'600'}]}>Referência: {new Date(item.referenceMonth+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</Text>}<Text style={[u.small,{fontSize:10}]}>Vence {item.date.split('-').reverse().join('/')} · saldo {money(item.balanceCents)}</Text></View><View style={{width:85}}><PreviewInput field={{label:'Valor para '+item.name,type:'money',compact:true}} value={row?.amount??initialAmount(item)} onChange={amount=>update(item.id,{amount})}/></View></View>;}):<View style={{gap:5}}><Text style={u.rowTitle}>Nenhuma obrigação em aberto</Text><Text style={u.small}>Selecione a pessoa ou cadastre o empréstimo antes.</Text></View>}<Text accessibilityLiveRegion="polite" style={[u.small,total>amountCents&&{color:C.red}]}>Distribuído {money(total)} de {money(amountCents)} · restante {money(amountCents-total)}</Text></View>;
}
