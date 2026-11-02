import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Animated,Easing,PanResponder,useWindowDimensions} from 'react-native';
import {View,TouchableOpacity} from './ThemePrimitives';
import {C,Icon} from './ui';
import {bankPresentation} from './institutions';
import type {BankRecord} from '../data/pluggyModel';
import Face from './BankCardFace';
import {useReducedMotion,FLUID_DURATION} from './AppMotion';
import Svg,{Defs,LinearGradient,Stop,Rect} from 'react-native-svg';

type Props={cards:BankRecord[];selected:string;onSelect:(id:string)=>void;name:string;limit:(card:BankRecord)=>number|null};
type Transition={from:number;to:number;direction:number;ids:string};
const rankOf=(index:number,front:number,count:number)=>(index-front+count)%count;

function Layer({card,fromRank,rank,width,name,limit,drag,progress,transition,onSelect,reduced}:{card:BankRecord;fromRank:number;rank:number;width:number;name:string;limit:Props['limit'];drag:Animated.Value;progress:Animated.Value;transition:Transition|null;onSelect:()=>void;reduced:boolean}){
 const {pose,shineX}=useMemo(()=>{
 const outgoing=!!transition&&fromRank===0;
 const interpolate=(from:number,to:number)=>progress.interpolate({inputRange:[0,1],outputRange:[from,to]});
 const position=interpolate(fromRank,rank);
 const gesture=Animated.multiply(drag,outgoing?interpolate(1,0):!transition&&rank===0&&!reduced?1:0);
 const x=outgoing?progress.interpolate({inputRange:[0,.8,1],outputRange:[0,transition!.direction*width*1.12,transition!.direction*width*1.12]}):Animated.multiply(position,7);
 return {shineX:Animated.multiply(gesture,.12),pose:{position:'absolute' as const,top:0,left:0,right:0,zIndex:outgoing?200:100-rank,transform:[{perspective:1000},{translateX:Animated.add(x,gesture)},{translateY:Animated.multiply(position,11)},{scale:position.interpolate({inputRange:[0,10],outputRange:[1,.55],extrapolate:'clamp'})},{rotate:position.interpolate({inputRange:[0,10],outputRange:['0deg','-35deg']})},{rotateY:gesture.interpolate({inputRange:[-150,150],outputRange:['-8deg','8deg'],extrapolate:'clamp'})}]}};
 },[fromRank,rank,width,drag,progress,transition,reduced]);
 // Keep native animation nodes stable across unrelated balance/data updates.
 return <Animated.View pointerEvents={transition?'none':'auto'} style={pose}>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={'Selecionar '+bankPresentation(card).title} onPress={onSelect} style={{width:'100%'}}><Face card={card} name={name} limit={limit}/></TouchableOpacity>
  <Animated.View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:18,overflow:'hidden',opacity:rank===0?.22:.06,transform:[{translateX:shineX}]}}><Svg width="100%" height="100%"><Defs><LinearGradient id="cardShine" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#fff" stopOpacity="0"/><Stop offset=".45" stopColor="#fff" stopOpacity=".48"/><Stop offset=".65" stopColor="#fff" stopOpacity="0"/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#cardShine)"/></Svg></Animated.View>
 </Animated.View>;
}

export default function BankCardCarousel({cards,selected,onSelect,name,limit}:Props){
 const viewport=useWindowDimensions(),[measured,setMeasured]=useState<number|null>(null),width=measured??Math.min(460,viewport.width)-32;
 const index=Math.max(0,cards.findIndex(c=>c.accountId===selected)),ids=cards.map(c=>c.id).join('|');
 const [transition,setTransition]=useState<Transition|null>(null),locked=useRef(false),progress=useRef(new Animated.Value(1)).current,drag=useRef(new Animated.Value(0)).current,reduced=useReducedMotion();
 // Ignore a stale transition when import changes the available card list.
 const motion=transition?.ids===ids?transition:null;
 useEffect(()=>{
  if(!transition){locked.current=false;return;}
  if(reduced||transition.ids!==ids){progress.stopAnimation();drag.setValue(0);locked.current=false;setTransition(null);return;}
  const animation=Animated.timing(progress,{toValue:1,duration:FLUID_DURATION,easing:Easing.bezier(.2,.75,.25,1),useNativeDriver:true});
  animation.start(({finished})=>{if(!finished)return;drag.setValue(0);setTransition(current=>current===transition?null:current);});
  return()=>animation.stop();
 },[transition,ids,reduced,progress,drag]);
 const choose=(target:number)=>{
  if(!cards.length||locked.current)return;
  const next=(target+cards.length)%cards.length;if(next===index)return;
  if(!reduced){locked.current=true;progress.setValue(0);setTransition({from:index,to:next,direction:target>index?-1:1,ids});}
  onSelect(cards[next]!.accountId);
 };
 const settle=()=>{if(locked.current)return;if(reduced)drag.setValue(0);else Animated.timing(drag,{toValue:0,duration:220,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();};
 // Keep gesture handlers stable across data/render updates during a swipe.
 const actions=useRef({choose,settle,reduced,count:cards.length,index});actions.current={choose,settle,reduced,count:cards.length,index};
 const pan=useMemo(()=>PanResponder.create({
  onMoveShouldSetPanResponder:(_e,g)=>!locked.current&&actions.current.count>1&&Math.abs(g.dx)>12&&Math.abs(g.dx)>Math.abs(g.dy)*1.5,
  onPanResponderGrant:()=>drag.stopAnimation(),
  onPanResponderMove:(_e,g)=>{if(!locked.current&&!actions.current.reduced)drag.setValue(g.dx*.55);},
  onPanResponderRelease:(_e,g)=>{if(Math.abs(g.dx)>40)actions.current.choose(actions.current.index+(g.dx<0?1:-1));actions.current.settle();},
  onPanResponderTerminate:()=>actions.current.settle()
 }),[]);
 return <View style={{gap:8}} onLayout={e=>{const next=e.nativeEvent.layout.width;setMeasured(old=>old!==null&&Math.abs(old-next)<.5?old:next);}}>
  <View {...pan.panHandlers} style={{height:width/1.585+28,marginHorizontal:cards.length>1?8:0}}>{cards.map((card,i)=><Layer key={card.id} card={card} fromRank={rankOf(i,motion?.from??index,cards.length)} rank={rankOf(i,motion?.to??index,cards.length)} width={width} name={name} limit={limit} drag={drag} progress={progress} transition={motion} reduced={reduced} onSelect={()=>choose(i)}/>)}</View>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cartão anterior" disabled={cards.length<2||!!motion} onPress={()=>choose(index-1)} style={{height:32,width:40,alignItems:'center',justifyContent:'center'}}><Icon name="back" size={15}/></TouchableOpacity>
   <View style={{flexDirection:'row',gap:7,alignItems:'center'}}>{cards.map((card,i)=><TouchableOpacity key={card.id} accessibilityRole="button" accessibilityLabel={'Mostrar cartão '+(i+1)} accessibilityState={{selected:i===index}} onPress={()=>choose(i)} style={{minWidth:28,height:30,alignItems:'center',justifyContent:'center'}}><View style={{height:6,width:i===index?20:6,borderRadius:5,backgroundColor:i===index?C.blue:C.line}}/></TouchableOpacity>)}</View>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Próximo cartão" disabled={cards.length<2||!!motion} onPress={()=>choose(index+1)} style={{height:32,width:40,alignItems:'center',justifyContent:'center'}}><Icon name="chevron" size={15}/></TouchableOpacity>
  </View>
 </View>;
}
