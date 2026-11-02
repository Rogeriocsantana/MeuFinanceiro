import {useReducedMotion,FLUID_DURATION} from './AppMotion';
import React,{ReactNode,useLayoutEffect,useMemo,useRef} from 'react';
import {AccessibilityInfo,Animated,Easing} from 'react-native';


/** Timing and distance follow p-sheet-in / app-chart-enter in the Apps Script. */
export function EnterMotion({children,kind='sheet'}:{children:ReactNode;kind?:'sheet'|'chart'}){
 const reduced=useReducedMotion(),progress=useRef(new Animated.Value(kind==='sheet'&&!reduced?0:1)).current,started=useRef(false);
 useLayoutEffect(()=>{if(reduced||kind==='chart'){started.current=true;progress.stopAnimation();progress.setValue(1);return;}if(started.current)return;started.current=true;const animation=Animated.timing(progress,{toValue:1,duration:FLUID_DURATION,easing:Easing.bezier(0,0,.58,1),useNativeDriver:true});animation.start();return()=>animation.stop();},[progress,reduced,kind]);
 const pose=useMemo(()=>({minHeight:0,flexShrink:1,...(kind==='sheet'?{width:'100%' as const,maxWidth:460,maxHeight:'98%' as const}:{}),transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[kind==='sheet'?18:0,0]})}]}),[progress,kind]);
 return <Animated.View style={pose}>{children}</Animated.View>;
}
