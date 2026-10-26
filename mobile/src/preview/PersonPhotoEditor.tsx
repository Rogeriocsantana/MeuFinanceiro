import React,{useState} from 'react';
import {View} from './ThemePrimitives';
import {Text} from './Typography';
import {Button,C,u} from './ui';
import {PersonAvatar} from './PersonAvatar';
import {pickProfilePhoto} from '../services/profilePhoto';
import {savePersonPhoto} from '../data/appPreferences';
export default function PersonPhotoEditor({scope,id,name}:{scope:string;id?:string;name:string}){
 const [revision,setRevision]=useState(0),[error,setError]=useState('');
 if(!id)return null;
 return <View style={{alignItems:'center',gap:10,paddingVertical:8}}><PersonAvatar scope={scope} id={id} name={name} size={82} revision={revision}/><View style={{flexDirection:'row',gap:8}}><Button compact secondary label="Alterar foto" icon="camera" onPress={async()=>{try{setError('');const photo=await pickProfilePhoto();if(photo){await savePersonPhoto(scope,id,photo);setRevision(n=>n+1);}}catch(e){setError((e as Error).message);}}}/><Button compact secondary label="Remover foto" onPress={async()=>{try{setError('');await savePersonPhoto(scope,id,null);setRevision(n=>n+1);}catch(e){setError((e as Error).message);}}}/></View>{!!error&&<Text accessibilityRole="alert" style={[u.small,{color:C.red}]}>{error}</Text>}</View>;
}
