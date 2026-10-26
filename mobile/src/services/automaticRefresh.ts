import type {AppPreferences} from '../data/appPreferences';

export type RefreshState={lastAttemptAt?:string;lastSuccessAt?:string};
export function refreshDue(preferences:AppPreferences,state:RefreshState,now:Date){
 const interval=preferences.refresh.intervalMinutes;
 if(interval===null||!Number.isFinite(now.getTime()))return false;
 const previous=Date.parse(state.lastAttemptAt||'');
 return !Number.isFinite(previous)||now.getTime()-previous>=interval*60000;
}
/** Native background scheduling is attached later. Both foreground and OS tasks use this gate. */
export function automaticRefreshRunner(deps:{load:()=>Promise<{preferences:AppPreferences;state:RefreshState}>;save:(state:RefreshState)=>Promise<void>;synchronize:()=>Promise<unknown>;now?:()=>Date}){
 let running:Promise<boolean>|null=null;
 const execute=async()=>{
  const {preferences,state}=await deps.load(),now=(deps.now||(()=>new Date()))();
  if(!refreshDue(preferences,state,now))return false;
  const next={...state,lastAttemptAt:now.toISOString()};await deps.save(next);
  await deps.synchronize();await deps.save({...next,lastSuccessAt:(deps.now||(()=>new Date()))().toISOString()});return true;
 };
 return ()=>running??=(execute().finally(()=>{running=null;}));
}
