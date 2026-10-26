import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {NativeModules,Platform,StyleSheet} from 'react-native';
export const C={bg:'#f5f7fb',ink:'#111827',muted:'#697386',blue:'#205dff',line:'#e2e7ef',green:'#16894c',red:'#c34242',white:'#fff',soft:'#eff4ff',elevated:'#f3f5f9'};
const darkColors:Record<string,string>={
 'rgba(17,24,39,0.38)':'rgba(17,24,39,0.38)','#17233f66':'#17233f66',
 '#f5f7fb':'#202020','#e9edf4':'#202020','#fff':'#292929','#ffffff':'#292929',
 '#111827':'#eef5fb','#697386':'#a6a6a6','#205dff':'#75a7ff','#e2e7ef':'#3a3a3a',
 '#16894c':'#6edb91','#c34242':'#ff8a86','#b7791f':'#f1c96a','#bd914e':'#f1c96a',
 '#eff4ff':'#323843','#f3f5f9':'#303030','#f3f5fa':'#303030','#f2f5ff':'#323843',
 '#eef2ff':'#323843','#f2f3fb':'#303030','#e8ecf3':'#3a3a3a','#e4e7ec':'#3a3a3a',
 '#e6ebf5':'#3a3a3a','#e4e8f0':'#3a3a3a','#edf0f6':'#3a3a3a','#e6eaf3':'#3a3a3a',
 '#dce2eb':'#505050','#cbd8ff':'#526d99','#dce5f8':'#465466','#edf1ff':'#323843','#f1f3f8':'#303030',
};
export function themeColor(value:unknown,dark:boolean,property='color'):any{
 if(!dark||typeof value!=='string')return value;
 const v=value.toLowerCase();
 // White lettering on the primary action and institution marks stays white.
 if(['color','stroke'].includes(property)&&(v==='#fff'||v==='#ffffff'))return value;
 if(property==='backgroundColor'&&v==='#205dff')return '#205dff';
 if(darkColors[v])return darkColors[v];
 if(/^#[\da-f]{8}$/i.test(v)&&darkColors[v.slice(0,7)])return darkColors[v.slice(0,7)]+v.slice(7);
 return value;
}
export function themeStyle(style:any,dark:boolean):any{
 if(!dark)return style;
 const flat=StyleSheet.flatten(style);if(!flat)return flat;
 return Object.fromEntries(Object.entries(flat).map(([key,value])=>[key,/color$/i.test(key)?themeColor(value,dark,key):value]));
}
const nativeTheme=Platform.OS==='android'?NativeModules.FinanceiroThemePreferences:undefined;
const savedNativeMode=nativeTheme?.hasSavedMode&&(nativeTheme.themeMode==='light'||nativeTheme.themeMode==='dark')?nativeTheme.themeMode as 'light'|'dark':null;
const persistNativeMode=(dark:boolean)=>{try{nativeTheme?.setMode(dark?'dark':'light');}catch{}};
const ThemeContext=createContext({dark:false,ready:true,toggle:()=>{}});
const key='financeiro.preview.theme';
export function ThemeProvider({children}:{children:React.ReactNode}){
 const touched=useRef(false);
 const [dark,setDark]=useState(()=>{if(savedNativeMode)return savedNativeMode==='dark';try{return Platform.OS==='web'&&localStorage.getItem(key)==='dark';}catch{return false;}});
 const [ready,setReady]=useState(Platform.OS==='web'||savedNativeMode!==null);
 useEffect(()=>{if(Platform.OS!=='web')return;const style=document.createElement('style');style.textContent='input:focus,textarea:focus{outline:2px solid var(--preview-focus)!important;outline-offset:1px}';document.head.appendChild(style);return()=>style.remove();},[]);
 useEffect(()=>{if(Platform.OS!=='web'&&savedNativeMode===null){let live=true;import('expo-sqlite/kv-store').then(m=>m.default.getItemAsync(key)).then(value=>{if(live&&!touched.current){setDark(value==='dark');persistNativeMode(value==='dark');}}).catch(()=>{}).finally(()=>{if(live)setReady(true);});return()=>{live=false;};}},[]);
 useEffect(()=>{if(Platform.OS==='web'){document.documentElement.style.colorScheme=dark?'dark':'light';document.documentElement.style.setProperty('--preview-focus',dark?'#75a7ff':C.blue);document.body.style.backgroundColor=dark?'#202020':C.bg;}},[dark]);
 const toggle=()=>{touched.current=true;setDark(previous=>{const next=!previous;persistNativeMode(next);try{if(Platform.OS==='web')localStorage.setItem(key,next?'dark':'light');else import('expo-sqlite/kv-store').then(m=>m.default.setItemAsync(key,next?'dark':'light')).catch(()=>{});}catch{}return next;});};
 return <ThemeContext.Provider value={{dark,ready,toggle}}>{children}</ThemeContext.Provider>;
}
export const useTheme=()=>useContext(ThemeContext);
