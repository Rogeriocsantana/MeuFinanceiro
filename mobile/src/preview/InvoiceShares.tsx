import {Text} from './Typography';
import React,{useState} from 'react';
import {View} from './ThemePrimitives';
import ChoiceField from './ChoiceField';
import PreviewInput from './PreviewInput';
import {Button,C,IconButton,money,u} from './ui';
import {parseMoneyCents} from './formValues';

export type InvoiceShare={id:string;person:string;amount:string;dueDate:string};
export default function InvoiceShares({totalCents,people,initial=[],value,onChange,onCreatePerson,fixedDueDate}:{totalCents:number;people:string[];initial?:InvoiceShare[];value?:InvoiceShare[];onChange?:(rows:InvoiceShare[])=>void;onCreatePerson?:(shareId:string)=>void;fixedDueDate?:string}){
 const [localShares,setLocalShares]=useState<InvoiceShare[]>(initial);
 const shares=(value??localShares).map(row=>fixedDueDate?{...row,dueDate:fixedDueDate}:row);
 const setShares=(update:(rows:InvoiceShare[])=>InvoiceShare[])=>{const next=update(shares);if(onChange)onChange(next);else setLocalShares(next);};
 const change=(id:string,key:keyof InvoiceShare,value:string)=>setShares(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row));
 const sum=shares.reduce((n,row)=>n+(parseMoneyCents(row.amount)||0),0);
 return <View style={{gap:14,paddingTop:0}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><Text style={[u.h2,{flex:1}]}>Quem utilizou o cartão?</Text><Button compact label="Pessoa" icon="plus" secondary onPress={()=>setShares(rows=>[...rows,{id:String(Date.now())+'-'+rows.length,person:'Selecione',amount:'',dueDate:fixedDueDate||''}])}/></View><Text style={u.small}>Deixe vazio se a compra é sua. O restante não atribuído continua sendo seu gasto.</Text>{shares.map((share,index)=><View key={share.id} style={{flexDirection:'row',alignItems:'flex-end',gap:7,marginBottom:0}}><View style={{flex:1,gap:7,minWidth:0}}><View style={{flexDirection:'row',alignItems:'flex-end',gap:7}}><View style={{flex:1,minWidth:0}}><ChoiceField label="Pessoa" onCreate={onCreatePerson?()=>onCreatePerson(share.id):undefined} createLabel="Nova pessoa" options={['Selecione',...people]} value={share.person} onChange={value=>change(share.id,'person',value)}/></View><View style={{width:100,gap:8}}><Text style={[u.label,{fontSize:11,color:C.muted}]}>Valor (R$)</Text><PreviewInput field={{label:'Valor da participação '+(index+1),type:'money',required:true}} value={share.amount} onChange={value=>change(share.id,'amount',value)}/></View></View><View style={{gap:8}}><Text style={[u.label,{fontSize:11,color:C.muted}]}>{fixedDueDate?'Vencimento da fatura':'Vencimento'}</Text>{fixedDueDate?<Text style={[u.rowTitle,{fontSize:13}]}>{fixedDueDate.split('-').reverse().join('/')}</Text>:<PreviewInput field={{label:'Vencimento da participação '+(index+1),type:'date'}} value={share.dueDate} onChange={value=>change(share.id,'dueDate',value)}/>}</View></View><View style={{width:36,alignItems:'center',paddingBottom:2}}><IconButton icon="trash" label={'Remover pessoa '+(share.person==='Selecione'?index+1:share.person)} onPress={()=>setShares(rows=>rows.filter(row=>row.id!==share.id))}/></View></View>)}<Text accessibilityLiveRegion="polite" style={[u.small,sum>totalCents&&{color:C.red}]}>Sua participação: {money(totalCents-sum)}</Text></View>;
}
