import BankIdentityReview from './BankIdentityReview';
import BankRevisionReview from './BankRevisionReview';
import {loadImportStart,saveImportStart} from '../services/importPreferences';
import PreviewInput from './PreviewInput';
import React,{useEffect,useState} from 'react';
import {loadBankData} from '../data/pluggyRepository';
import {type LocalBankData} from '../data/pluggyModel';
import {Text} from './Typography';
import {View} from './ThemePrimitives';
import {Card,Button,Row,InstitutionMark,Bubble,u} from './ui';
import {bankPresentation} from './institutions';
import BankDiagnosticsPanel from './BankDiagnosticsPanel';
export default function OpenFinanceConnections({onRefresh,onConfigure,onRestored}:{onRestored?:()=>void|Promise<void>;onRefresh:()=>void|Promise<void>;onConfigure:()=>void}){
 const [data,setData]=useState<LocalBankData|null>(null),[error,setError]=useState(''),[from,setFrom]=useState('');
 useEffect(()=>{void loadImportStart().then(setFrom).catch(e=>setError(e.message));let active=true;loadBankData().then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError('Não foi possível ler as conexões salvas neste aparelho.');});return()=>{active=false;};},[]);
 const groups=new Map<string,{name:string;accounts:number;cards:number}>();
 for(const record of data?.records||[]){if(!['account','card'].includes(record.kind))continue;const bank=bankPresentation(record),group=groups.get(bank.identity.id)||{name:bank.identity.name,accounts:0,cards:0};if(record.kind==='card')group.cards++;else group.accounts++;groups.set(bank.identity.id,group);}
 return <><BankDiagnosticsPanel/><Card><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={u.h2}>Atualizar tudo</Text><Bubble icon="refresh"/></View><Text style={u.small}>Importe os dados disponíveis das suas conexões e salve neste aparelho para consultar offline.</Text><Text style={u.label}>Importar movimentos a partir de</Text><PreviewInput field={{label:"Início da importação",type:"date"}} value={from} onChange={setFrom}/><Text style={u.small}>Amplie o período quando quiser. Dados e classificações já salvos são mantidos. O saldo atual é independente deste período.</Text><Button globalLoading label="Atualizar tudo" icon="refresh" onPress={async()=>{setError('');try{await saveImportStart(from);await onRefresh();setData(await loadBankData());}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar.');}}}/>{!!error&&<Text accessibilityRole="alert" style={u.small}>{error}</Text>}</Card><BankIdentityReview data={data} refreshSignal={error} onChanged={async()=>{setError('');setData(await loadBankData());await onRestored?.();}}/><BankRevisionReview data={data} onChanged={async()=>{setData(await loadBankData());await onRestored?.();}}/><Card><Text style={u.h2}>Conexões configuradas</Text>{groups.size?[...groups.entries()].map(([id,group],index)=><Row divider={index<groups.size-1} key={id} title={group.name} subtitle={`${group.accounts} conta(s) · ${group.cards} cartão(ões) · dados importados`} avatar={<InstitutionMark name={group.name}/>} onPress={onConfigure}/>):<><Text style={u.muted}>Nenhuma instituição importada ainda.</Text><Text style={u.small}>Configure sua Pluggy e toque em Atualizar tudo. Aqui aparecerão somente os bancos da sua conexão.</Text></>}</Card><Button label="Configurar minha Pluggy" icon="gear" secondary onPress={onConfigure}/></>;
}

