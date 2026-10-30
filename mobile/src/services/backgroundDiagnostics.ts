export function backgroundRunDescription(last:{status:string;at:string;stage?:string;error?:string}|null,now=Date.now()){
 if(!last)return 'Ainda não há execução em segundo plano registrada nesta versão.';
 const stages:Record<string,string>={'checking-interval':'verificando intervalo','open-finance':'consultando Open Finance','d1':'sincronizando D1','notifications':'preparando notificações'};
 const labels:Record<string,string>={running:'em execução',updated:'atualizada','not-due':'executada; intervalo ainda não vencido',failed:'falhou'};
 const stale=last.status==='running'&&now-Date.parse(last.at)>10*60000;
 return 'Última execução em segundo plano: '+new Date(last.at).toLocaleString('pt-BR')+' · '+(stale?'sem conclusão registrada; pode ter sido interrompida':labels[last.status]||last.status)+(last.stage?' · Última etapa: '+(stages[last.stage]||last.stage):'')+(last.error?' · '+last.error:'');
}
