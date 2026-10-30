import {refreshIndependent} from './refreshIndependent';
import {Platform} from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {loadBankData} from '../data/pluggyRepository';
import {loadAppPreferences,loadRefreshState,saveRefreshState,saveDeviceEvent} from '../data/appPreferences';
import {automaticRefreshRunner} from './automaticRefresh';
import {synchronizePluggy} from './pluggySync';
import {synchronizeRemote} from './remoteSync';
import {scheduleFinancialNotifications,notifyBankUpdated} from './notifications';
const TASK='financeiro-bank-refresh';
const runners=new Map<string,()=>Promise<boolean>>();
const backgroundStarts=new Map<string,string>();
async function stage(scope:string,name:string){const startedAt=backgroundStarts.get(scope);if(startedAt)await saveDeviceEvent(scope,'background-latest',{startedAt,at:new Date().toISOString(),status:'running',stage:name});}
export async function runAutomaticRefresh(scope:string){
 if(__DEV__&&(scope==='parity-review'||scope==='previsual-native-validation'||process.env.EXPO_PUBLIC_ISOLATED_BANK_VALIDATION==='1'))return false;
 if(!runners.has(scope))runners.set(scope,automaticRefreshRunner({load:async()=>({preferences:await loadAppPreferences(scope),state:await loadRefreshState(scope),latestImportAt:(await loadBankData())?.syncedAt}),save:state=>saveRefreshState(scope,state),synchronize:async()=>{const outcomes=await refreshIndependent(async()=>{await stage(scope,'open-finance');return synchronizePluggy();},async()=>{await stage(scope,'d1');return synchronizeRemote();});if(outcomes.bank.status==='rejected')throw outcomes.bank.reason;const result=outcomes.bank.value;await stage(scope,'notifications');const data=await loadBankData();if(data)await Promise.allSettled([scheduleFinancialNotifications(data),notifyBankUpdated(data,result.changed)]);}}));
 return runners.get(scope)!();
}
if(Platform.OS!=='web'&&!TaskManager.isTaskDefined(TASK))TaskManager.defineTask(TASK,async()=>{
 let scope='';try{const data=await loadBankData();if(data){scope=data.scope;backgroundStarts.set(scope,new Date().toISOString());await stage(scope,'checking-interval');const changed=await runAutomaticRefresh(scope);await saveDeviceEvent(scope,'background-latest',{at:new Date().toISOString(),startedAt:backgroundStarts.get(scope),status:changed?'updated':'not-due'});}return BackgroundTask.BackgroundTaskResult.Success;}catch(e){if(scope)await saveDeviceEvent(scope,'background-latest',{at:new Date().toISOString(),startedAt:backgroundStarts.get(scope),status:'failed',error:e instanceof Error?e.message:'Falha na execução'}).catch(()=>{});return BackgroundTask.BackgroundTaskResult.Failed;}finally{if(scope)backgroundStarts.delete(scope);}
});
let configuring:Promise<void>=Promise.resolve();
export function configureAutomaticRefresh(scope:string,intervalMinutes:number|null){
 const update=async()=>{
  if(Platform.OS==='web')return;
  const registered=await TaskManager.isTaskRegisteredAsync(TASK);
  if(intervalMinutes===null){if(registered)await BackgroundTask.unregisterTaskAsync(TASK);return;}
  if(registered){const options=await TaskManager.getTaskOptionsAsync<{minimumInterval?:number}>(TASK);if(options?.minimumInterval===intervalMinutes)return;}
  if(!await TaskManager.isAvailableAsync())throw Error('Atualização em segundo plano indisponível neste aparelho. A verificação ao abrir o app continua ativa.');
  await BackgroundTask.registerTaskAsync(TASK,{minimumInterval:intervalMinutes});
 };
 const work=configuring.catch(()=>{}).then(update);configuring=work;return work;
}
