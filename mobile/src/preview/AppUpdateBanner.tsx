import React,{useEffect,useState} from 'react';
import {Alert,AppState,NativeModules,Platform} from 'react-native';
import Constants from 'expo-constants';
import {View,TouchableOpacity} from './ThemePrimitives';
import {Text} from './Typography';
import {C} from './ui';
import {latestRelease,type AppRelease} from '../services/appRelease';
export default function AppUpdateBanner(){
 const [release,setRelease]=useState<AppRelease|null>(null),[hidden,setHidden]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{if(Platform.OS!=='android')return;let active=true,last=0;const check=()=>{if(Date.now()-last<3600000)return;last=Date.now();void latestRelease(Constants.nativeBuildVersion?Number(Constants.nativeBuildVersion):Constants.expoConfig?.android?.versionCode||0).then(value=>{if(active)setRelease(value);}).catch(()=>{});};check();const sub=AppState.addEventListener('change',state=>{if(state==='active')check();});return()=>{active=false;sub.remove();};},[]);
 if(!release||hidden)return null;
 const install=async()=>{setBusy(true);try{const result=await NativeModules.FinanceiroUpdater.install(release.url,release.sha256,release.versionCode,release.size);if(result==='permission')Alert.alert('Permitir atualização','Autorize este aplicativo a instalar atualizações e depois toque em Atualizar novamente.');}catch(e){Alert.alert('Atualização',(e as Error).message||'Não foi possível atualizar. Tente novamente.');}finally{setBusy(false);}};
 return <View style={{backgroundColor:C.soft,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10}}><Text style={{fontSize:24,color:C.blue}}>⇩</Text><View style={{flex:1}}><Text style={{fontSize:14,fontWeight:'700',color:C.ink}}>{release.version} · {(release.size/1048576).toFixed(1)} MB</Text><Text style={{fontSize:12,color:C.muted}}>{busy?'Baixando e verificando…':'Atualização disponível'}</Text></View><TouchableOpacity accessibilityLabel="Novidades da atualização" onPress={()=>Alert.alert('Novidades · '+release.version,release.notes)} style={{padding:8}}><Text style={{color:C.blue,fontSize:20}}>ⓘ</Text></TouchableOpacity><TouchableOpacity disabled={busy} onPress={install} style={{backgroundColor:C.blue,padding:12,borderRadius:24}}><Text style={{color:'#fff',fontWeight:'700'}}>{busy?'Aguarde':'Atualizar'}</Text></TouchableOpacity>{!busy&&<TouchableOpacity accessibilityLabel="Dispensar atualização" onPress={()=>setHidden(true)} style={{padding:6}}><Text style={{fontSize:24,color:C.muted}}>×</Text></TouchableOpacity>}</View>;
}

