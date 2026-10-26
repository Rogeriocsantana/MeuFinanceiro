import {Platform} from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {loadBankData} from '../data/pluggyRepository';
import {loadAppPreferences,loadRefreshState,saveRefreshState} from '../data/appPreferences';
import {automaticRefreshRunner} from './automaticRefresh';
import {synchronizePluggy} from './pluggySync';
import {synchronizeRemote} from './remoteSync';
import {scheduleFinancialNotifications,notifyBankUpdated} from './notifications';
const TASK='financeiro-bank-refresh';
const runners=new Map<string,()=>Promise<boolean>>();
export async function runAutomaticRefresh(scope:string){
 if(__DEV__&&(scope==='parity-review'||scope==='previsual-native-validation'||process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION==='1'))return false;
 if(!runners.has(scope))runners.set(scope,automaticRefreshRunner({load:async()=>({preferences:await loadAppPreferences(scope),state:await loadRefreshState(scope)}),save:state=>saveRefreshState(scope,state),synchronize:async()=>{const result=await synchronizePluggy();try{await synchronizeRemote();}catch{}const data=await loadBankData();if(data)await Promise.allSettled([scheduleFinancialNotifications(data),notifyBankUpdated(data,result.changed)]);}}));
 return runners.get(scope)!();
}
if(Platform.OS!=='web'&&!TaskManager.isTaskDefined(TASK))TaskManager.defineTask(TASK,async()=>{
 try{const data=await loadBankData();if(data)await runAutomaticRefresh(data.scope);return BackgroundTask.BackgroundTaskResult.Success;}catch{return BackgroundTask.BackgroundTaskResult.Failed;}
});
export async function configureAutomaticRefresh(scope:string,intervalMinutes:number|null){
 if(Platform.OS==='web')return;
 if(intervalMinutes===null){if(await TaskManager.isTaskRegisteredAsync(TASK))await BackgroundTask.unregisterTaskAsync(TASK);return;}
 if(await TaskManager.isAvailableAsync())await BackgroundTask.registerTaskAsync(TASK,{minimumInterval:intervalMinutes});
}
