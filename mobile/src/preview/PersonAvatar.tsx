import React,{useEffect,useState} from 'react';
import {Image} from 'react-native';
import {View} from './ThemePrimitives';
import {Text} from './Typography';
import {C} from './ui';
import {loadPersonPhoto} from '../data/appPreferences';
export function ProfileAvatar({name,photo,size=36}:{name:string;photo?:string|null;size?:number}){
 return <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:C.soft,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>{photo?<Image source={{uri:photo}} style={{width:size,height:size}}/>:<Text style={{fontSize:size*.34,color:C.blue,fontWeight:'600'}}>{name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()||<></>}</Text>}</View>;
}
export function PersonAvatar({scope,id,name,size=36,revision}:{scope:string;id?:string;name:string;size?:number;revision?:unknown}){
 const [photo,setPhoto]=useState<string|null>(null);
 useEffect(()=>{let live=true;setPhoto(null);if(id)loadPersonPhoto(scope,id).then(value=>{if(live)setPhoto(value);}).catch(()=>{});return()=>{live=false;};},[scope,id,revision]);
 return <ProfileAvatar name={name} photo={photo} size={size}/>;
}
