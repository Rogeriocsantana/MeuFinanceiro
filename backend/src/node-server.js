// Alternative host adapter: Node 22+ behind an HTTPS reverse proxy.
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handle} from './api.js';

export function fileCredentialStore(directory){
 const root=resolve(directory),path=key=>join(root,createHash('sha256').update(key).digest('hex')+'.json');
 return {
  async get(key){try{return await readFile(path(key),'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}},
  async put(key,value){await mkdir(root,{recursive:true,mode:0o700});const temporary=path(key)+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,value,{mode:0o600,flag:'wx'});await rename(temporary,path(key));}finally{await rm(temporary,{force:true});}},
 };
}
export function createApiServer(env){return createServer(async(req,res)=>{
 try{
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>8192){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const method=req.method||'GET',body=Buffer.concat(chunks);
  const request=new Request('http://api.internal'+(req.url||'/'),{method,headers:req.headers,...(!['GET','HEAD'].includes(method)&&body.length?{body}: {})});
  const response=await handle(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"SERVICE_UNAVAILABLE"}');}
 });}
// This entrypoint is imported by tests and can also run directly.
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 const env={...process.env,CREDENTIAL_STORE:fileCredentialStore(process.env.CREDENTIAL_DIRECTORY||'.private-credentials')};
 createApiServer(env).listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1');
}
