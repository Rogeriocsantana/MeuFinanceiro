import * as Storage from './workerStorage';
export type WorkerConfig={url:string;token:string};
export type ConnectionStatus={canManageFamily?:boolean;adminBrowserSession?:number;service:string;version:string;credentialStorage:boolean;pluggyConfigured:boolean;d1Enabled?:boolean;syncProtocol?:number;remoteDatabase?:{configured:boolean;provider?:string}};
export function validateWorkerUrl(value:string){
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Informe a URL HTTPS do seu servidor.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Use somente a URL HTTPS do servidor, sem caminhos ou parâmetros.');
 return url.origin;
}
export async function loadWorkerConfig():Promise<WorkerConfig|null>{const value=await Storage.getItemAsync('financeiro-worker-connection');return value?JSON.parse(value):null;}
const messages:Record<string,string>={UNAUTHORIZED:'Token de acesso inválido ou revogado.',CREDENTIAL_STORAGE_NOT_CONFIGURED:'Configure o armazenamento de credenciais no servidor antes de salvar a Pluggy.',INVALID_CONFIG:'Confira as credenciais e os IDs das conexões.',ORIGIN_NOT_ALLOWED:'Esta prévia não foi autorizada no servidor.',SERVICE_UNAVAILABLE:'Não foi possível validar a Pluggy. Confira as credenciais ou tente novamente.'};
async function request(config:WorkerConfig,path:string,method='GET',body?:unknown){
 const base=validateWorkerUrl(config.url);if(!/^[A-Za-z0-9_-]{43,128}$/.test(config.token))throw new Error('Informe o token de acesso ao servidor.');
 if(!path.startsWith('/v1/')||path.includes('://'))throw new Error('Rota inválida.');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('O servidor demorou para responder. Tente novamente.'));},25000);});
 try{return await Promise.race([(async()=>{
  let response:Response;try{response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+config.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:controller.signal});}catch{throw new Error(controller.signal.aborted?'O servidor demorou para responder. Tente novamente.':'Não foi possível acessar o servidor. Confira o endereço e sua conexão com a internet.');}
  let result:any;try{result=await response.json();}catch{throw new Error(controller.signal.aborted?'O servidor demorou para responder. Tente novamente.':'O endereço não respondeu como uma API do Financeiro.');}
  if(!response.ok)throw new Error(messages[result.error]||'Integração indisponível ('+response.status+').');return result;
 })(),deadline]);}finally{if(timer)clearTimeout(timer);}
}
export function assertConnectionOwner(localScope:string|null|undefined,candidateScope:string){if(localScope&&localScope!==candidateScope)throw new Error('Este aparelho possui dados de outra pessoa. Use o arquivo de configuração correspondente à mesma pessoa.');}
export async function connectWorker(config:WorkerConfig,localScope?:string):Promise<ConnectionStatus>{
 const normalized={url:validateWorkerUrl(config.url),token:config.token.trim()};
 const status=await request(normalized,'/v1/connection');
 if(status.service!=='financeiro-api'||typeof status.credentialStorage!=='boolean')throw new Error('Servidor incompatível. Atualize o backend do Financeiro.');
 const me=await request(normalized,'/v1/me');if(typeof me.id!=='string'||!me.id)throw new Error('O servidor não confirmou a identidade desta conexão.');
 const scope=normalized.url+'|'+me.id;
 assertConnectionOwner(localScope,scope);
 assertConnectionOwner(await Storage.getItemAsync('financeiro-worker-owner'),scope);
 await Storage.setItemAsync('financeiro-worker-owner',scope);
 await Storage.setItemAsync('financeiro-worker-connection',JSON.stringify(normalized));return status;
}
export async function checkWorker():Promise<ConnectionStatus>{const config=await loadWorkerConfig();if(!config)throw new Error('Conecte primeiro o servidor.');return request(config,'/v1/connection');}
export async function savePluggyConfig(clientId:string,clientSecret:string,itemIds:string[]){const config=await loadWorkerConfig();if(!config)throw new Error('Conecte primeiro o servidor.');const status:ConnectionStatus=await request(config,'/v1/connection');if(!status.credentialStorage)throw new Error('Configure o armazenamento seguro no servidor.');await request(config,'/v1/pluggy/config','PUT',{clientId,clientSecret,itemIds});return {...status,pluggyConfigured:true};}
export async function workerGet(path:string){const config=await loadWorkerConfig();if(!config)throw new Error('Conecte primeiro o servidor.');return request(config,path);}
export async function saveWorkerToken(token:string){const config=await loadWorkerConfig();await connectWorker({url:config?.url||'',token});}

// Provider-neutral names; legacy exports remain compatible with existing callers.
export const connectServer=connectWorker,checkServer=checkWorker,loadServerConfig=loadWorkerConfig;

export async function syncRequest(path:string,body?:unknown){const config=await loadWorkerConfig();if(!config)throw new Error("Conecte o servidor para sincronizar.");return request(config,path,body?"POST":"GET",body);}






export async function requestAdminBrowserTicket(){const config=await loadServerConfig();if(!config)throw Error("Conecte primeiro o servidor.");return request(config,"/v1/admin/browser-ticket","POST",{});}
