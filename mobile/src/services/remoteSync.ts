import {checkServer,loadServerConfig,workerGet,syncRequest} from './worker';
import {applySavedPurchaseSeries} from '../data/purchaseRepository';
import {getRemoteStatus,configureRemote,captureLocal,pendingOperations,applyResults,mergeChanges,remoteOutcome,resolveRemote} from '../data/remoteRepository';
let running:Promise<void>|null=null;
export async function enableRemote(enabled:boolean){
 const config=await loadServerConfig();
 if(!enabled){const status=await getRemoteStatus();for(const state of status.states.filter(s=>!config||s.scope.startsWith(config.url+'|')))await configureRemote(state.scope,false);return;}
 if(!config)throw new Error('Conecte o servidor antes de configurar o sincronismo.');
 const status=await checkServer();if(status.syncProtocol!==1)throw new Error('O servidor ainda não oferece sincronização compatível.');
 const me=await workerGet('/v1/me');const scope=config.url+'|'+me.id;await configureRemote(scope,true);await captureLocal(scope);
}
export function synchronizeRemote(){if(running)return running;running=execute().finally(()=>{running=null;});return running;}
async function execute(){
 const config=await loadServerConfig();if(!config)return;const state=(await getRemoteStatus()).states.find(s=>s.enabled&&s.scope.startsWith(config.url+'|'));if(!state)return;
 // Queue local edits even when the network is unavailable.
 await captureLocal(state.scope);
 try{
  const me=await workerGet('/v1/me');if(state.scope!==config.url+'|'+me.id)throw new Error('O usuário do servidor mudou. Ative o sincronismo para essa identidade.');
  let cursor=state.cursor;
  for(let page=0;page<1000;page++){const result=await syncRequest('/v1/sync?after='+cursor);if(!Array.isArray(result.changes)||!Number.isSafeInteger(result.cursor)||result.cursor<cursor||result.hasMore&&result.cursor===cursor)throw new Error('Resposta de sincronismo inválida.');await mergeChanges(state.scope,result.changes,result.cursor);cursor=result.cursor;if(!result.hasMore)break;if(page===999)throw new Error('Retome a sincronização para continuar o histórico.');}
  await applySavedPurchaseSeries(state.scope);
  await captureLocal(state.scope);
  // Bound each pass; a subsequent pass continues a durable queue.
  for(let batch=0;batch<100;batch++){if(!(await getRemoteStatus()).states.some(s=>s.scope===state.scope&&s.enabled))return;const operations=await pendingOperations(state.scope);if(!operations.length)break;const result=await syncRequest('/v1/sync',{operations});if(!Array.isArray(result.results))throw new Error('Resposta incompleta.');await applyResults(state.scope,operations,result.results);}
  await captureLocal(state.scope);await remoteOutcome(state.scope);
 }catch(error){await remoteOutcome(state.scope,error instanceof Error?error.message:'Sincronização interrompida.');throw error;}
}

export async function resolveConflict(scope:string,type:string,id:string,choice:"local"|"remote"){if(running)await running.catch(()=>{});await resolveRemote(scope,type,id,choice);await synchronizeRemote();}
