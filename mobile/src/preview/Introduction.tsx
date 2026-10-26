import {useStartupReady} from './Startup';
import React,{useEffect,useState} from 'react';
import {Platform} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import * as storage from '../services/secrets';
import {SafeAreaView,View,ScrollView,TouchableOpacity} from './ThemePrimitives';
import {Text} from './Typography';
import {Icon,Button,C,u} from './ui';
import {useTheme} from './Theme';
const steps=[
 {icon:'wallet',title:'Seu financeiro, com você',body:'Consulte suas contas, cartões e movimentações em um só lugar. Organize categorias e acompanhe seu dinheiro.'},
 {icon:'shield',title:'Seus dados neste aparelho',body:'Depois de importar, seus dados ficam no SQLite do celular. Você pode consultar os dados salvos sem internet. A conexão é necessária para trazer novas movimentações.'},
 {icon:'refresh',title:'Conecte quando estiver pronto',body:'Configure seu servidor e a integração Pluggy para importar dados reais do Open Finance. A sincronização com um banco remoto é opcional; o armazenamento local é a base do aplicativo.'},
];
export default function Introduction({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState(Platform.OS==='web'),[done,setDone]=useState(Platform.OS==='web'),[index,setIndex]=useState(0),[error,setError]=useState(''),[readError,setReadError]=useState('');
 const {dark}=useTheme(),markStartupReady=useStartupReady();

 const loadIntroduction=async()=>{setReady(false);setReadError('');try{const value=await storage.getItemAsync('introduction-v1');setDone(value==='done');}catch{setReadError('Não foi possível verificar a introdução salva. Tente novamente.');}finally{setReady(true);}};
 useEffect(()=>{if(Platform.OS!=='web')void loadIntroduction();},[]);
 useEffect(()=>{if(ready&&(!done||readError))markStartupReady();},[ready,done,readError,markStartupReady]);
 const finish=async()=>{try{await storage.setItemAsync('introduction-v1','done');setDone(true);}catch{setError('Não foi possível salvar. Tente novamente.');}};
 if(!ready)return <SafeAreaView style={{flex:1,backgroundColor:C.bg}}/>;
 if(readError)return <SafeAreaView style={{flex:1,backgroundColor:C.bg,justifyContent:'center',padding:24,gap:20}}><StatusBar style={dark?'light':'dark'}/><Text accessibilityRole="alert" style={u.muted}>{readError}</Text><Button label="Tentar novamente" onPress={loadIntroduction}/></SafeAreaView>;
 if(done)return <>{children}</>;
 const step=steps[index]!;
 return <SafeAreaView style={{flex:1,backgroundColor:C.bg}}><StatusBar style={dark?'light':'dark'}/><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:20}}><Text style={u.h2}>Financeiro</Text><TouchableOpacity accessibilityRole="button" onPress={finish} style={{padding:12}}><Text style={u.link}>Pular</Text></TouchableOpacity></View><ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',padding:28,gap:24}}><View style={{width:88,height:88,borderRadius:26,backgroundColor:C.soft,alignItems:'center',justifyContent:'center'}}><Icon name={step.icon} size={44} color={C.blue}/></View><Text accessibilityRole="header" style={{fontSize:30,lineHeight:38,fontWeight:'700',color:C.ink}}>{step.title}</Text><Text style={{fontSize:16,lineHeight:26,color:C.muted}}>{step.body}</Text><Text style={u.small}>Versão de testes · algumas funções ainda estão em preparação.</Text></ScrollView><View style={{padding:24,gap:20}}><View accessibilityLabel={`Etapa ${index+1} de ${steps.length}`} style={{flexDirection:'row',justifyContent:'center',gap:8}}>{steps.map((_,i)=><View key={i} style={{width:i===index?24:8,height:8,borderRadius:4,backgroundColor:i===index?C.blue:C.line}}/>)}</View>{!!error&&<Text accessibilityRole="alert" style={{color:C.red}}>{error}</Text>}<Button icon={index===steps.length-1?'check':'chevron'} label={index===steps.length-1?'Começar':'Continuar'} onPress={index===steps.length-1?finish:()=>setIndex(index+1)}/>{index>0&&<TouchableOpacity accessibilityRole="button" onPress={()=>setIndex(index-1)} style={{padding:10,alignItems:'center'}}><Text style={u.link}>Voltar</Text></TouchableOpacity>}</View></SafeAreaView>;
}

