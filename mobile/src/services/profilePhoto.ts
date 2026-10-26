import * as Picker from 'expo-image-picker';
import * as Manipulator from 'expo-image-manipulator';
export async function pickProfilePhoto(){
 const result=await Picker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:1});
 if(result.canceled)return null;
 const asset=result.assets[0];if(!asset)throw Error('Não foi possível abrir a foto.');
 for(const size of [320,200,120]){
  const image=await Manipulator.manipulateAsync(asset.uri,[{resize:{width:size}}],{compress:.65,format:Manipulator.SaveFormat.JPEG,base64:true});
  if(image.base64&&image.base64.length<330000)return 'data:image/jpeg;base64,'+image.base64;
 }
 throw Error('A foto é muito grande. Escolha outra imagem.');
}
