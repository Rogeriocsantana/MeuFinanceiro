import {storageReady,saveCredentials,readCredentials} from './credentials.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function managedUser(env,digest){
 if(!env.DB||!env.ADMIN_USER_ID)return null;
 return env.DB.prepare('SELECT id FROM family_access WHERE token_hash=? AND disabled=0').bind(digest).first();
}
export async function administer(request,env,user,hashToken){
 if(!env.ADMIN_USER_ID||user.id!==env.ADMIN_USER_ID||user.managed)return json({error:'FORBIDDEN'},403);
 if(!env.DB||!storageReady(env))return json({error:'ADMIN_NOT_CONFIGURED'},409);
 const url=new URL(request.url),match=url.pathname.match(/^\/v1\/admin\/users\/([a-zA-Z0-9_-]{1,64})\/(configuration|status)$/);
 if(url.pathname==='/v1/admin/users'&&request.method==='GET'){
  const rows=await env.DB.prepare('SELECT id,name,disabled,created_at FROM family_access ORDER BY created_at,id').bind().all();
  return json({users:rows.results,administrator:user.id});
 }
 if(url.pathname==='/v1/admin/users'&&request.method==='POST'){
  const raw=await request.text();if(raw.length>2048)return json({error:'PAYLOAD_TOO_LARGE'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'INVALID_CONFIG'},400);}
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)return json({error:'INVALID_NAME'},400);
  const id='family-'+crypto.randomUUID(),token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const createdAt=new Date().toISOString();
  // Save the downloadable token encrypted, separately from the member's Pluggy credentials.
  await saveCredentials(env,'admin-profile:'+id,{token});
  await env.DB.batch([env.DB.prepare('INSERT INTO family_access(id,name,token_hash,created_at) VALUES(?,?,?,?)').bind(id,body.name.trim(),await hashToken(token),createdAt)]);
  return json({user:{id,name:body.name.trim(),disabled:0,created_at:createdAt},configuration:{format:'financeiro-connection',version:1,server:{url:url.origin,token}}},201);
 }
 if(match&&request.method==='GET'&&match[2]==='configuration'){
  const row=await env.DB.prepare('SELECT id,name,disabled FROM family_access WHERE id=?').bind(match[1]).first();
  if(!row)return json({error:'NOT_FOUND'},404);
  if(row.disabled)return json({error:'ACCESS_DISABLED'},409);
  const saved=await readCredentials(env,'admin-profile:'+row.id);if(!saved?.token)return json({error:'CONFIGURATION_UNAVAILABLE'},503);
  return json({format:'financeiro-connection',version:1,server:{url:url.origin,token:saved.token}});
 }
 if(match&&request.method==='POST'&&match[2]==='status'){
  const raw=await request.text();if(raw.length>512)return json({error:'PAYLOAD_TOO_LARGE'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'INVALID_CONFIG'},400);}
  if(typeof body.enabled!=='boolean')return json({error:'INVALID_CONFIG'},400);
  const row=await env.DB.prepare('SELECT id FROM family_access WHERE id=?').bind(match[1]).first();if(!row)return json({error:'NOT_FOUND'},404);
  await env.DB.batch([env.DB.prepare('UPDATE family_access SET disabled=? WHERE id=?').bind(body.enabled?0:1,row.id)]);
  return json({updated:true});
 }
 return json({error:'NOT_FOUND'},404);
}
