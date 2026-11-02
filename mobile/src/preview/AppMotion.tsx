import {themeStyle,useTheme} from './Theme';
import React,{createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {AccessibilityInfo,Animated,Easing,View,LayoutAnimation,Platform,UIManager} from 'react-native';
const Reduced=createContext(true);
const Sequence=createContext<{route:string;next:number}|null>(null);
export function useMotionOrder(){const sequence=useContext(Sequence),order=useRef<{route:string;index:number}|null>(null);if(sequence&&order.current?.route!==sequence.route)order.current={route:sequence.route,index:sequence.next++};return {route:sequence?.route,delay:Math.min((order.current?.index||0)*75,450)};}

export const FLUID_DURATION=320;
export function MotionProvider({children}:{children:ReactNode}){const [reduced,setReduced]=useState(true);useEffect(()=>{let alive=true;AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(alive)setReduced(v);}).catch(()=>{});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);if(Platform.OS==='android')UIManager.setLayoutAnimationEnabledExperimental?.(true);return()=>{alive=false;sub.remove();};},[]);return <Reduced.Provider value={reduced}>{children}</Reduced.Provider>;}
export const useReducedMotion=()=>useContext(Reduced);
export function useFluidValue(value:number,duration=FLUID_DURATION,native=true){const reduced=useReducedMotion(),v=useRef(new Animated.Value(value)).current,target=useRef(value);useLayoutEffect(()=>{if(reduced){v.stopAnimation();v.setValue(value);target.current=value;return;}if(Object.is(target.current,value))return;target.current=value;const a=Animated.timing(v,{toValue:value,duration,easing:Easing.bezier(.2,.75,.25,1),useNativeDriver:native});a.start();return()=>a.stop();},[value,reduced,duration,v,native]);return v;}
/** Page content stays fixed. Motion is limited to explicit gestures and panels. */
export function MotionEntry({children,style}:{children:ReactNode;delay?:number;style?:any;distance?:number;trigger?:string}){const {dark}=useTheme();return <View style={themeStyle(style,dark)}>{children}</View>;}

export function MotionScene({children,route}:{children:ReactNode;route:string}){const sequence=useMemo(()=>({route,next:0}),[route]);const gap=route.startsWith('analysis:')?12:route.startsWith('income:')?14:16;return <Sequence.Provider value={sequence}><View style={{gap}}>{children}</View></Sequence.Provider>;}

/** Animate geometry for an explicit disclosure only; never fade newly mounted/deleted rows. */
export function useDisclosureMotion(){const reduced=useReducedMotion();return()=>{if(!reduced)LayoutAnimation.configureNext({duration:240,update:{type:LayoutAnimation.Types.easeInEaseOut}});};}
