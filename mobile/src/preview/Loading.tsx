import LoadingVisual from './LoadingVisual';
import {createActionGate} from './actionGate';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,View,useWindowDimensions} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
type LoadingState={error:string|null;action:string|null;active:boolean;run:(id:string,work:()=>void|Promise<void>)=>Promise<void>;pulse:()=>void};
const LoadingContext=createContext<LoadingState>({error:null,action:null,active:false,run:async(_id,work)=>{await work();},pulse:()=>{}});
export const PREVIEW_ACTION_DELAY=0;
export function LoadingProvider({children}:{children:React.ReactNode}){
 const [error,setError]=useState<string|null>(null);
 const [action,setAction]=useState<string|null>(null);
 const gate=useRef(createActionGate(setAction,PREVIEW_ACTION_DELAY)),alive=useRef(true);
 // Navigation is immediate; show the loading bar only for an actual running action.
 const pulse=()=>{};
 useEffect(()=>{alive.current=true;gate.current.activate();return()=>{alive.current=false;gate.current.dispose();};},[]);
 const run=async(id:string,work:()=>void|Promise<void>)=>{try{setError(null);await gate.current.run(id,work);}catch(error){if(alive.current)setError(error instanceof Error?error.message:'Não foi possível concluir a ação. Tente novamente.');}};
 return <LoadingContext.Provider value={{error,action,active:!!action,run,pulse}}>{children}</LoadingContext.Provider>;
}
export const useLoading=()=>useContext(LoadingContext);
export function LoadingBar({placement='top'}:{placement?:'top'|'bottom'}){const {active,action}=useLoading();return <LoadingVisual active={active&&(!action||action.startsWith('global:'))} placement={placement}/>;}

