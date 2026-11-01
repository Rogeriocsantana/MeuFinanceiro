export type BackgroundOutcome={bank:'updated'|'failed';remote:'synced'|'pending'|'disabled'|'unconfigured'|'failed';notificationError?:string};
export function backgroundOutcomeText(result:BackgroundOutcome){
 const remote={synced:'sincronizado',pending:'com pendências',disabled:'desativado',unconfigured:'não configurado',failed:'falhou'}[result.remote];
 return 'Open Finance: '+(result.bank==='updated'?'consultado':'não concluído; confira no app')+'. D1: '+remote+'.';
}
