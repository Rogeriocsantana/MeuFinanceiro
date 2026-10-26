import {validateWorkerUrl,type WorkerConfig} from './worker';
export function parseConnectionProfile(text:string):WorkerConfig{
 if(text.length>8192)throw new Error('Arquivo de configuração muito grande.');
 let value:any;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Selecione um arquivo JSON de configuração válido.');}
 if(value?.format!=='financeiro-connection'||value.version!==1||!value.server||typeof value.server.url!=='string'||typeof value.server.token!=='string')throw new Error('Formato de configuração não reconhecido.');
 const url=validateWorkerUrl(value.server.url),token=value.server.token.trim();
 if(token&&!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw new Error('Token de acesso inválido no arquivo.');
 return {url,token};
}
