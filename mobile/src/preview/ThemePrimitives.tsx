import React from 'react';
import * as RN from 'react-native';
import {SafeAreaView as NativeSafeAreaView} from 'react-native-safe-area-context';
import {useLoading} from './Loading';
import {themeColor,themeStyle,useTheme} from './Theme';
// Resolve the existing palette at render time, including StyleSheet IDs and inline styles.
// This keeps one layout definition for Android and web; no CSS inversion is used.
export const View=React.forwardRef<RN.View,RN.ViewProps>((p,r)=>{const {dark}=useTheme();return <RN.View {...p} ref={r} style={themeStyle(p.style,dark)}/>;});
export type View=RN.View;
export const TouchableOpacity=React.forwardRef<React.ElementRef<typeof RN.TouchableOpacity>,RN.TouchableOpacityProps>((p,r)=>{const {dark}=useTheme();const {action}=useLoading();return <RN.TouchableOpacity {...p} {...(RN.Platform.OS==='web'?{'aria-checked':p.accessibilityState?.checked,'aria-expanded':p.accessibilityState?.expanded,'aria-busy':p.accessibilityState?.busy}:{})} disabled={p.disabled||!!action} accessibilityState={{...p.accessibilityState,disabled:p.disabled||!!action}} ref={r} style={themeStyle(p.style,dark)}/>;});
export const Pressable=React.forwardRef<React.ElementRef<typeof RN.Pressable>,RN.PressableProps>((p,r)=>{const {dark}=useTheme();const {action}=useLoading();return <RN.Pressable {...p} disabled={p.disabled||!!action} ref={r} style={typeof p.style==='function'?state=>themeStyle((p.style as Function)(state),dark):themeStyle(p.style,dark)}/>;});
export const ScrollView=React.forwardRef<RN.ScrollView,RN.ScrollViewProps>((p,r)=>{const {dark}=useTheme();return <RN.ScrollView {...p} ref={r} style={themeStyle(p.style,dark)} contentContainerStyle={themeStyle(p.contentContainerStyle,dark)}/>;});
export type ScrollView=RN.ScrollView;
export const SafeAreaView=React.forwardRef<React.ElementRef<typeof NativeSafeAreaView>,React.ComponentProps<typeof NativeSafeAreaView>>((p,r)=>{const {dark}=useTheme();return <NativeSafeAreaView {...p} ref={r} style={themeStyle(p.style,dark)}/>;});
export const TextInput=React.forwardRef<RN.TextInput,RN.TextInputProps>((p,r)=>{const {dark}=useTheme();const {action}=useLoading();const style=themeStyle(p.style,dark),search=/buscar|busca|pesquisar/i.test((p.accessibilityLabel||'')+' '+(p.placeholder||''))&&!p.multiline&&!p.secureTextEntry;const input=<RN.TextInput {...p} editable={p.editable!==false&&!action} ref={r} style={[style,search&&{flex:1,minWidth:0,borderWidth:0,backgroundColor:'transparent',padding:0,paddingHorizontal:0,paddingVertical:0,margin:0,height:undefined,minHeight:0},RN.Platform.OS==='web'&&{outlineOffset:-2} as RN.TextStyle]} placeholderTextColor={themeColor(p.placeholderTextColor||'#697386',dark)}/>;if(!search)return input;return <RN.View style={[style,{flexDirection:'row',alignItems:'center'}]}>{input}{!!p.value&&<RN.Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" disabled={p.editable===false||!!action} hitSlop={6} onPress={()=>p.onChangeText?.('')} style={{width:36,minHeight:36,alignItems:'center',justifyContent:'center'}}><RN.Text style={{fontSize:23,lineHeight:26,color:themeColor('#697386',dark)}}>×</RN.Text></RN.Pressable>}</RN.View>;});

