import React,{ReactNode,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing} from 'react-native';


/** Timing and distance follow p-sheet-in / app-chart-enter in the Apps Script. */
export function EnterMotion({children,kind='sheet'}:{children:ReactNode;kind?:'sheet'|'chart'}){
 const progress=useRef(new Animated.Value(0)).current;
 const [reduced,setReduced]=useState<boolean|null>(null);
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduced(value);});const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{active=false;subscription.remove();};},[]);
 useEffect(()=>{if(reduced===null)return;if(reduced){progress.setValue(1);return;}progress.setValue(0);const animation=Animated.timing(progress,{toValue:1,duration:kind==='sheet'?180:400,easing:Easing.bezier(0,0,.58,1),useNativeDriver:true});animation.start();return()=>animation.stop();},[progress,reduced,kind]);
 return <Animated.View style={{minHeight:0,flexShrink:1,...(kind==='sheet'?{width:'100%',maxWidth:460,maxHeight:'98%'}:{}),opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[kind==='sheet'?18:8,0]})},{scale:progress.interpolate({inputRange:[0,1],outputRange:[kind==='chart'?.97:1,1]})}]}}>{children}</Animated.View>;
}
