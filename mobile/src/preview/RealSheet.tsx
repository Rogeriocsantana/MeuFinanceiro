import React,{type ReactNode,useEffect,useState} from 'react';
import {Modal,StyleSheet,Platform,Keyboard,KeyboardAvoidingView} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SafeAreaView,View,ScrollView,TouchableOpacity} from './ThemePrimitives';
import {Text} from './Typography';
import {Button,IconButton,C,u} from './ui';
import {EnterMotion} from './Motion';
import {LoadingBar,useLoading} from './Loading';
export type RealSheetProps={title:string;subtitle?:string;children:ReactNode;onClose:()=>void;onSave?:()=>void|Promise<void>;submitLabel?:string;error?:string;footer?:ReactNode};
export default function RealSheet({title,subtitle,children,onClose,onSave,submitLabel='Salvar',error,footer}:RealSheetProps){
 const [keyboardVisible,setKeyboardVisible]=useState(()=>Platform.OS==='android'&&Keyboard.isVisible());
 useEffect(()=>{
  if(Platform.OS!=='android')return;
  const show=Keyboard.addListener('keyboardDidShow',()=>setKeyboardVisible(true));
  const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboardVisible(false));
  return()=>{show.remove();hide.remove();};
 },[]);
 const {action}=useLoading();const close=()=>{if(!action)onClose();};
 // The native modal can overlap the IME in the APK even with adjustResize.
 // RN 0.81 also computes overlap from Android's hide event, which can retain
 // system-bar height. Disable its padding when hidden without remounting the form.
 // iOS keeps native keyboard avoidance; web keeps its existing layout.
 return <Modal transparent visible animationType="none" onRequestClose={close}><SafeAreaProvider><KeyboardAvoidingView enabled={Platform.OS==='android'?keyboardVisible:Platform.OS!=='web'} behavior="padding" style={{flex:1}}><SafeAreaView style={s.outer}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar painel" style={s.scrim} onPress={close}/><EnterMotion><View style={s.sheet}><View style={s.handle}/><View style={s.heading}><View style={{flex:1,gap:8}}><Text accessibilityRole="header" style={[u.h2,{fontSize:21,lineHeight:27.3,fontWeight:'700'}]}>{title}</Text>{!!subtitle&&<Text style={[u.small,{fontSize:12,lineHeight:19.2}]}>{subtitle}</Text>}</View><IconButton icon="close" label="Fechar" onPress={close}/></View><ScrollView keyboardShouldPersistTaps="handled" style={{flexShrink:1}} contentContainerStyle={{gap:18,paddingBottom:22}} showsVerticalScrollIndicator={false}>{!!error&&<Text accessibilityRole="alert" style={{color:C.red}}>{error}</Text>}{children}</ScrollView><View style={s.footer}>{footer||<><View style={{flex:1}}><Button footer label={onSave?'Cancelar':'Fechar'} secondary onPress={close}/></View>{onSave&&<View style={{flex:1}}><Button footer label={submitLabel} onPress={onSave}/></View>}</>}</View></View></EnterMotion></SafeAreaView></KeyboardAvoidingView></SafeAreaProvider></Modal>;
}
const s=StyleSheet.create({outer:{flex:1,justifyContent:'flex-end',alignItems:'center'},scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(17,24,39,0.38)',...(Platform.OS==='web'?{backdropFilter:'blur(2px)'}:{})},sheet:{position:'relative',width:'100%',maxWidth:460,flexShrink:1,backgroundColor:'#fff',paddingTop:26,paddingHorizontal:20,borderTopLeftRadius:25,borderTopRightRadius:25},heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:8,paddingBottom:18},handle:{position:'absolute',top:8,height:4,width:36,borderRadius:4,backgroundColor:'#dce2eb',alignSelf:'center'},footer:{flexDirection:'row',gap:12,marginHorizontal:-20,paddingHorizontal:20,borderTopWidth:1,borderTopColor:C.line,paddingTop:14,paddingBottom:18}});
