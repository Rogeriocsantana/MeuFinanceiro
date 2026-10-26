import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {Platform} from 'react-native';
import {parseConnectionProfile} from './connectionProfile';
export async function pickConnectionProfile(){
 const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});
 if(result.canceled)return null;
 const asset=result.assets[0];if(!asset)throw new Error('Nenhum arquivo selecionado.');
 try{
  if(asset.size!==undefined&&asset.size>8192)throw new Error('Arquivo de configuração muito grande.');
  const text=Platform.OS==='web'&&asset.file?await asset.file.text():await FileSystem.readAsStringAsync(asset.uri);
  return parseConnectionProfile(text);
 }finally{
  // Only remove the picker cache copy, never the user's original document.
  if(Platform.OS!=='web'&&FileSystem.cacheDirectory&&asset.uri.startsWith(FileSystem.cacheDirectory))await FileSystem.deleteAsync(asset.uri,{idempotent:true}).catch(()=>{});
 }
}
