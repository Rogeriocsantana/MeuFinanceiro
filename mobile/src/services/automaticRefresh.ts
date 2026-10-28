import type {AppPreferences} from '../data/appPreferences';

export type RefreshState={lastAttemptAt?:string;lastSuccessAt?:string};
export function refreshDue(preferences:AppPreferences,state:RefreshState,now:Date,latestImportAt?:string){
 const interval=preferences.refresh.intervalMinutes,stamp=now.getTime();
 if(interval===null||!Number.isFinite(stamp))return false;
 const successes=[state.lastSuccessAt,latestImportAt].map(value=>Date.parse(value||'')).filter(Number.isFinite);
 const success=successes.length?Math.max(...successes):NaN;
 if(Number.isFinite(success)&&stamp-success<interval*60000)return false;
 // A failed attempt must not postpone another try for the entire chosen interval.
 const attempt=Date.parse(state.lastAttemptAt||'');
 return !Number.isFinite(attempt)||stamp-attempt>=60000;
}
/** Foreground and OS tasks share the same gate and in-flight request. */
export function automaticRefreshRunner(deps:{load:()=>Promise<{preferences:AppPreferences;state:RefreshState;latestImportAt?:string}>;save:(state:RefreshState)=>Promise<void>;synchronize:()=>Promise<unknown>;now?:()=>Date}){
 let running:Promise<boolean>|null=null;
 const execute=async()=>{
  const {preferences,state,latestImportAt}=await deps.load(),now=(deps.now||(()=>new Date()))();
  if(!refreshDue(preferences,state,now,latestImportAt))return false;
  const next={...state,lastAttemptAt:now.toISOString()};await deps.save(next);
  await deps.synchronize();await deps.save({...next,lastSuccessAt:(deps.now||(()=>new Date()))().toISOString()});return true;
 };
 return ()=>running??=(execute().finally(()=>{running=null;}));
}
/** Check on entry and resume, rather than waiting for the first timer tick. */
export function startForegroundRefresh(deps:{active:()=>boolean;run:()=>Promise<boolean>;updated:()=>Promise<unknown>;failed:()=>void;subscribe:(listener:()=>void)=>()=>void;repeat:(listener:()=>void)=>()=>void}){
 let stopped=false;
 const check=()=>{if(stopped||!deps.active())return;void deps.run().then(changed=>{if(changed&&!stopped)return deps.updated();}).catch(()=>{if(!stopped)deps.failed();});};
 const unsubscribe=deps.subscribe(check),cancel=deps.repeat(check);check();
 return ()=>{stopped=true;unsubscribe();cancel();};
}
