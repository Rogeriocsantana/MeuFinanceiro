import {Platform,Linking} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {loadServerConfig,workerGet,validateWorkerUrl,requestAdminBrowserTicket} from './worker';
/** Use the saved, validated server. Never put credentials in browser URLs. */
export async function openAdminBrowser(){
 const config=await loadServerConfig();if(!config)throw Error('Conecte primeiro seu servidor.');
 const status=await workerGet('/v1/connection');if(status.canManageFamily!==true)throw Error('Este acesso não oferece administração de familiares.');
 const origin=validateWorkerUrl(config.url);let path='/admin';
 if(status.adminBrowserSession===1){const ticket=await requestAdminBrowserTicket();if(typeof ticket.path!=='string'||!/^\/admin#handoff=[A-Za-z0-9_-]{43}$/.test(ticket.path))throw Error('Autorização temporária inválida.');path=ticket.path;}
 const url=origin+path;
 if(Platform.OS==='web'){await Linking.openURL(url);return;}
 await WebBrowser.openBrowserAsync(url,{toolbarColor:'#f5f7fb',controlsColor:'#205dff',showTitle:true,enableBarCollapsing:false});
}
