import React from 'react';
import {View,TouchableOpacity} from './ThemePrimitives';
import {Text} from './Typography';
import {C,Icon,IconButton,u,money} from './ui';
import {PageIntro,HeroCard,compactPeriod,v} from './MobileVisual';
import {wealthSummary} from '../data/wealthSummary';
import {monthlyOverview} from '../data/bankOverview';
import {bankSourceFreshness,type LocalBankData} from '../data/pluggyModel';
import type {Control,Reconciliation} from '../data/localControls';
import type {AppPreferences} from '../data/appPreferences';
import {useTheme} from './Theme';
export default function DashboardSummary({data,controls,preferences,picker,month,hidden,toggle,nav,income,expense}:{data:LocalBankData;controls:Control[];preferences:AppPreferences;picker:React.ReactNode;month:string;hidden:boolean;toggle:()=>void;nav:(key:string)=>void;income:number;expense:number}){
 const {dark}=useTheme();
 const wealth=wealthSummary(data,controls),lastUpdate=Date.parse(bankSourceFreshness(data.records)?.newest||''),date=new Date(month+'-01T12:00:00');date.setMonth(date.getMonth()-1);
 const previousMonth=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'),prior=monthlyOverview(data,previousMonth,controls.filter(c=>c.type==='reconciliations') as unknown as Reconciliation[],controls),delta=income-expense-(prior.income-prior.expense),hasPrior=data.records.some(r=>r.kind==='transaction'&&(r.invoiceMonth||r.date.slice(0,7))===previousMonth);
 const priorBalance=prior.income-prior.expense;
 const comparison=priorBalance===0?'Sem base percentual':(delta>0?'+':'')+(delta/Math.abs(priorBalance)*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
 const masked=(value:number)=>hidden?'••••':money(value);
 return <><PageIntro title={preferences.profile.name?'Olá, '+preferences.profile.name.split(' ')[0]:'Seu dinheiro'} subtitle={Number.isFinite(lastUpdate)?'Última atualização em '+new Date(lastUpdate).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Data de atualização do banco indisponível'} accessory={compactPeriod(picker)}/><HeroCard><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={u.small}>Patrimônio acompanhado</Text><IconButton icon="eye" label={hidden?'Mostrar saldo':'Ocultar saldo'} onPress={toggle}/></View><View style={{flexDirection:'row',alignItems:'baseline',gap:10,flexWrap:'wrap'}}><Text accessibilityLabel={hidden?'Saldo oculto':undefined} style={v.heroValue}>{masked(wealth.total)}</Text></View><View style={{flexDirection:'row',gap:7}}>{[['Contas',wealth.available,'accounts'],['Cofrinhos',wealth.reserves,'assets'],['Investimentos',wealth.invested,'assets']].map(([label,value,page])=><TouchableOpacity key={label} accessibilityRole="button" onPress={()=>nav(String(page))} style={{flex:1,backgroundColor:dark?'rgba(255,255,255,.045)':'rgba(255,255,255,.6)',borderRadius:13,padding:9,gap:6}}><Text style={[u.small,{fontSize:10}]}>{label}</Text><Text style={[u.rowValue,{fontSize:12}]}>{masked(Number(value))}</Text></TouchableOpacity>)}</View><View style={{flexDirection:'row',gap:10,paddingTop:4}}>{[['Entrou',income,C.green,'income','arrowdown'],['Saiu',expense,C.red,'analysis','arrowup']].map(([label,value,color,page,icon])=><TouchableOpacity key={label} accessibilityRole="button" onPress={()=>nav(String(page))} style={{flex:1,flexDirection:'row',alignItems:'center',gap:5,minHeight:30}}><Icon name={String(icon)} color={String(color)} size={14}/><Text style={[u.small,{fontSize:11,color:String(color)}]}>{label} {masked(Number(value))}</Text></TouchableOpacity>)}</View><Text style={[u.small,{fontSize:9}]}>Posições atuais · entradas e saídas no mês selecionado</Text></HeroCard></>;
}
