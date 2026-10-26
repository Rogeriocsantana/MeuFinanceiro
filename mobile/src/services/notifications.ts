import {Linking,Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {notificationPlan,notificationPrefix} from '../data/notificationPlan';
import {listControls} from '../data/localControls';
import {loadAppPreferences,recordDeviceEvent} from '../data/appPreferences';
import type {LocalBankData} from '../data/pluggyModel';
const channel='financeiro-lembretes';
if(Platform.OS!=='web')Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function configureNotifications(enabled:boolean){
 if(Platform.OS==='web')return;
 if(!enabled){const rows=await Notifications.getAllScheduledNotificationsAsync();await Promise.all(rows.filter(r=>r.identifier.startsWith('financeiro-')).map(r=>Notifications.cancelScheduledNotificationAsync(r.identifier)));return;}
 await Notifications.setNotificationChannelAsync(channel,{name:'Lembretes financeiros',importance:Notifications.AndroidImportance.DEFAULT});
 const current=await Notifications.getPermissionsAsync(),permission=current.granted?current:await Notifications.requestPermissionsAsync();
 if(!permission.granted)throw Error('Permita as notificações nas configurações do Android para receber os avisos.');
}
export async function scheduleFinancialNotifications(data:LocalBankData){
 if(Platform.OS==='web')return;
 const preferences=await loadAppPreferences(data.scope),prefix=notificationPrefix(data.scope);
 const desired=notificationPlan(data,await listControls(),preferences),scheduled=await Notifications.getAllScheduledNotificationsAsync();
 for(const old of scheduled.filter(r=>r.identifier.startsWith(prefix)))if(!desired.some(e=>e.id===old.identifier))await Notifications.cancelScheduledNotificationAsync(old.identifier);
 if(!preferences.notifications.enabled)return;
 if(!(await Notifications.getPermissionsAsync()).granted)return;
 for(const event of desired){
  const old=scheduled.find(r=>r.identifier===event.id);
  if(old?.content.data?.scheduledAt===event.at.toISOString()&&old.content.body===event.body)continue;
  if(old)await Notifications.cancelScheduledNotificationAsync(old.identifier);
  await Notifications.scheduleNotificationAsync({identifier:event.id,content:{title:event.title,body:event.body,data:{page:event.page,name:event.name||'',scheduledAt:event.at.toISOString()}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:event.at,channelId:channel}});
 }
}
export function openNotificationSettings(){return Platform.OS==='android'?Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS',[{key:'android.provider.extra.APP_PACKAGE',value:Constants.appOwnership==='expo'?'host.exp.exponent':Constants.expoConfig?.android?.package||'com.roger.financeiro'}]):Linking.openSettings();}
export async function notifyBankUpdated(data:LocalBankData,changed:number){
 if(Platform.OS==='web'||changed<=0)return;
 const preferences=await loadAppPreferences(data.scope);
 if(!preferences.notifications.enabled||!preferences.notifications.types.includes('bank-updated')||!(await Notifications.getPermissionsAsync()).granted)return;
 const stamp=data.records.filter(r=>r.kind==='account'||r.kind==='card').map(r=>r.id+':'+(r.metadata.sourceUpdatedAt||data.syncedAt)).sort().join('|'),id=notificationPrefix(data.scope+stamp)+'bank-updated';
 if(!await recordDeviceEvent(data.scope,id,{status:'scheduled',at:new Date().toISOString()}))return;
 await Notifications.scheduleNotificationAsync({identifier:id,content:{title:'Dados bancários atualizados',body:'Suas contas foram atualizadas no Financeiro.',data:{page:'home'}},trigger:null});
}
export function onNotificationOpen(navigate:(page:string,name?:string)=>void){
 if(Platform.OS==='web')return()=>{};
 const visit=(response:Notifications.NotificationResponse)=>{const {page,name}=response.notification.request.content.data;if(typeof page==='string'&&['home','cards','loan'].includes(page)){navigate(page,typeof name==='string'?name:undefined);Notifications.clearLastNotificationResponse();}};
 const listener=Notifications.addNotificationResponseReceivedListener(visit);
 void Notifications.getLastNotificationResponseAsync().then(result=>{if(result)visit(result);}).catch(()=>{});
 return()=>listener.remove();
}
