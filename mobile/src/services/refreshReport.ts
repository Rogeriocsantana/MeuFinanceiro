import type {RemoteSyncResult} from './remoteSync';
export type RefreshReport={bank:{title:string;detail:string};remote:{title:string;detail:string}};
export function refreshReport(bank:PromiseSettledResult<{changed:number}>,remote:PromiseSettledResult<RemoteSyncResult>):RefreshReport{
 const reason=(e:unknown)=>e instanceof Error?e.message:'Tente novamente e confira Integrações.';
 const bankRow=bank.status==='fulfilled'?{title:'Open Finance · atualizado',detail:bank.value.changed+' registros novos ou atualizados.'}:{title:'Open Finance · não concluído',detail:reason(bank.reason)};
 if(remote.status==='rejected')return {bank:bankRow,remote:{title:'D1 · falhou',detail:reason(remote.reason)+' As alterações locais permanecem preservadas. Confira a fila em Integrações.'}};
 const r=remote.value;
 if(r.status==='disabled'||r.status==='unconfigured')return {bank:bankRow,remote:{title:'D1 · '+(r.status==='disabled'?'desativado':'não configurado'),detail:'Não houve sincronização com o D1. Ative a sincronização remota em Integrações.'}};
 return {bank:bankRow,remote:{title:r.status==='synced'?'D1 · sincronizado':'D1 · com pendências',detail:r.pending+' operações aguardando envio · '+r.conflicts+' conflitos.'+(r.lastSuccess?' Comunicação: '+new Date(r.lastSuccess).toLocaleString('pt-BR')+'.':'')+(r.status==='pending'?' Confira Integrações para concluir.':'')}};
}
