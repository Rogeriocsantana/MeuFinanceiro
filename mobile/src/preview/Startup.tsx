import React,{createContext,useContext,useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Image,Platform,View,Text} from 'react-native';
import {useTheme} from './Theme';
import {StatusBar} from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

if(Platform.OS!=='web')void SplashScreen.preventAutoHideAsync().catch(()=>{});
const StartupContext=createContext<()=>void>(()=>{});
export const useStartupReady=()=>useContext(StartupContext);
/** Native and JS splash share the same image, 160dp box, center and background. */
export default function Startup({children}:{children:React.ReactNode}){
 const [finished,setFinished]=useState(Platform.OS==='web'),[imageReady,setImageReady]=useState(false),[layoutReady,setLayoutReady]=useState(false);
 const [appReady,setAppReady]=useState(Platform.OS==='web');const markReady=useCallback(()=>setAppReady(true),[]);
 const progress=useRef(new Animated.Value(0)).current;
 const {dark,ready}=useTheme();
 useEffect(()=>{
  if(Platform.OS==='web'||!ready||!imageReady||!layoutReady||!appReady)return;
  let active=true;let animation:Animated.CompositeAnimation|undefined;
  AccessibilityInfo.isReduceMotionEnabled().catch(()=>true).then(async reduced=>{
   if(!active)return;
   await SplashScreen.hideAsync().catch(()=>{});
   if(!active)return;
   if(reduced){setFinished(true);return;}
   animation=Animated.sequence([
    Animated.delay(250),
    Animated.timing(progress,{toValue:1,duration:650,useNativeDriver:true}),
    Animated.delay(1500),
    Animated.timing(progress,{toValue:2,duration:450,useNativeDriver:true}),
   ]);
   animation.start(({finished:complete})=>{if(active&&complete)setFinished(true);});
  });
  return()=>{active=false;animation?.stop();};
 },[progress,imageReady,layoutReady,ready,appReady]);
 return <StartupContext.Provider value={markReady}><View style={{flex:1}}><View style={{flex:1}} accessibilityElementsHidden={!finished} importantForAccessibility={finished?'auto':'no-hide-descendants'} pointerEvents={finished?'auto':'none'}>{children}</View>{!finished&&<View onLayout={()=>setLayoutReady(true)} style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:dark?'#202020':'#f5f7fb'}}><StatusBar style={dark?'light':'dark'}/><Animated.View style={{position:'absolute',top:'50%',left:'50%',width:160,height:160,marginTop:-80,marginLeft:-80,opacity:progress.interpolate({inputRange:[0,1,2],outputRange:[1,1,0]})}}><Image source={require('../../assets/splash.png')} onLoad={()=>setImageReady(true)} onError={()=>setImageReady(true)} resizeMode="contain" style={{width:160,height:160}}/></Animated.View><Animated.View style={{position:'absolute',top:'50%',marginTop:92,left:24,right:24,gap:12,alignItems:'center',opacity:progress.interpolate({inputRange:[0,1,2],outputRange:[0,1,0]})}}><Text style={{fontSize:28,fontWeight:'700',color:dark?'#eef5fb':'#111827'}}>Financeiro</Text><Text style={{fontSize:14,color:dark?'#a6a6a6':'#697386'}}>Seu dinheiro, sempre com você.</Text></Animated.View></View>}</View></StartupContext.Provider>;
}

