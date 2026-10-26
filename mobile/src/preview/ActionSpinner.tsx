import React,{useEffect,useRef} from 'react';
import {AccessibilityInfo,Animated,Easing} from 'react-native';
import Svg,{Circle} from 'react-native-svg';
/** Apps Script .p-spinner: 17px, 2px stroke, one open quadrant, 800ms. */
export default function ActionSpinner({color}:{color:string}){
 const rotation=useRef(new Animated.Value(0)).current;
 useEffect(()=>{let live=true,animation:Animated.CompositeAnimation|undefined;AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{if(!live||reduced)return;animation=Animated.loop(Animated.timing(rotation,{toValue:1,duration:800,easing:Easing.linear,useNativeDriver:true}));animation.start();});return()=>{live=false;animation?.stop();};},[rotation]);
 return <Animated.View style={{width:17,height:17,transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}><Svg width={17} height={17} viewBox="0 0 17 17"><Circle cx={8.5} cy={8.5} r={7.5} fill="none" stroke={color} strokeWidth={2} strokeDasharray="35.343 11.781" transform="rotate(45 8.5 8.5)"/></Svg></Animated.View>;
}
