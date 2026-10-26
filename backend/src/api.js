import {issueBrowserTicket,redeemBrowserTicket,browserSessionUser,logoutBrowser} from './adminSession.js';
import {managedUser,administer} from './familyAdmin.js';
import {adminAsset} from './adminPage.js';
import {synchronize} from './sync.js';
import {storageReady,saveCredentials,readCredentials} from './credentials.js';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
async function limitedBody(request){
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return null;}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);
}
export async function hashToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
async function authenticate(request, env) {
  const bearer = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
  if (!bearer) return null;
  const digest = await hashToken(bearer);
  const users = JSON.parse(env.USERS_JSON || '[]');
  const existing=users.find(u => u.tokenHash === digest && u.id && !u.disabled);if(existing)return existing;const managed=await managedUser(env,digest);return managed?{...managed,managed:true}:null;
}
async function providerAuth(user,fetcher){
  const auth = await fetcher('https://api.pluggy.ai/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: user.pluggyClientId, clientSecret: user.pluggyClientSecret }), signal: AbortSignal.timeout(15000) });
  if (!auth.ok) throw new Error('PROVIDER_AUTH');
  const { apiKey } = await auth.json();
  if (!apiKey) throw new Error('PROVIDER_AUTH');
  return apiKey;
}
async function pluggy(path, user, fetcher) {
  const apiKey=await providerAuth(user,fetcher);
  const result = await fetcher(`https://api.pluggy.ai${path}`, { headers: { 'X-API-KEY': apiKey }, signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw new Error('PROVIDER_REQUEST');
  return result.json();
}
async function handleRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return json({ service: 'financeiro-api', version: '0.2.0' });
  try {
    const asset=adminAsset(request);if(asset)return asset;
    if(url.pathname==='/admin/session')return await redeemBrowserTicket(request,env,hashToken);
    const bearerUser=await authenticate(request,env);
    if(url.pathname==='/v1/admin/browser-ticket'&&request.method==='POST')return await issueBrowserTicket(request,env,bearerUser,hashToken);
    const user = bearerUser||(url.pathname.startsWith('/v1/admin/')?await browserSessionUser(request,env,hashToken):null);
    if (!user) return json({ error: 'UNAUTHORIZED' }, 401);
    if(url.pathname==='/v1/admin/browser-logout'&&request.method==='POST'&&user.id===env.ADMIN_USER_ID&&!user.managed)return await logoutBrowser(request,env,hashToken);
    if(url.pathname.startsWith('/v1/admin/'))return administer(request,env,user,hashToken);
    if (url.pathname === '/v1/sync') return await synchronize(request,env.DB,user.id);
    if (url.pathname === '/v1/me' && request.method === 'GET') {const saved=await readCredentials(env,user.id);return json({id:user.id,itemIds:saved?.itemIds||user.itemIds||[]});}
    if (url.pathname === '/v1/connection' && request.method === 'GET') {
      const saved=await readCredentials(env,user.id);
      return json({...(env.ADMIN_USER_ID?{canManageFamily:user.id===env.ADMIN_USER_ID&&!user.managed,adminBrowserSession:env.DB?1:0}:{}),service:'financeiro-api',version:'0.2.0',credentialStorage:storageReady(env),pluggyConfigured:!!saved||!!(user.pluggyClientId&&user.pluggyClientSecret),d1Enabled:!!env.DB,syncProtocol:env.DB?1:0,remoteDatabase:{configured:!!env.REMOTE_DATABASE||!!env.DB,provider:env.REMOTE_DATABASE_PROVIDER||(env.DB?'D1':undefined)}});
    }
    if (url.pathname === '/v1/pluggy/config' && request.method === 'PUT') {
      if(!storageReady(env))return json({error:'CREDENTIAL_STORAGE_NOT_CONFIGURED'},409);
      if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'INVALID_CONTENT_TYPE'},415);
      const text=await limitedBody(request);if(text===null)return json({error:'PAYLOAD_TOO_LARGE'},413);
      let body;try{body=JSON.parse(text);}catch{return json({error:'INVALID_CONFIG'},400);}
      if(!body||typeof body.clientId!=='string'||typeof body.clientSecret!=='string'||!body.clientId.trim()||!body.clientSecret.trim()||body.clientId.length>200||body.clientSecret.length>2048||!Array.isArray(body.itemIds)||body.itemIds.length>50||body.itemIds.some(id=>typeof id!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(id)))return json({error:'INVALID_CONFIG'},400);
      const credentials={clientId:body.clientId.trim(),clientSecret:body.clientSecret.trim(),itemIds:[...new Set(body.itemIds)]};
      const providerUser={pluggyClientId:credentials.clientId,pluggyClientSecret:credentials.clientSecret};
      await providerAuth(providerUser,fetcher);
      for(const id of credentials.itemIds){const item=await pluggy('/items/'+encodeURIComponent(id),providerUser,fetcher);if(item.id!==id)return json({error:'INVALID_ITEM'},400);}
      await saveCredentials(env,user.id,credentials);
      return json({configured:true});
    }
    const saved=await readCredentials(env,user.id);
    if(saved){user.pluggyClientId=saved.clientId;user.pluggyClientSecret=saved.clientSecret;user.itemIds=saved.itemIds;}
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const info=url.pathname.match(/^\/v1\/pluggy\/items\/([a-zA-Z0-9-]+)\/info$/);
    if(info){if(!user.itemIds?.includes(info[1]))return json({error:'FORBIDDEN'},403);const item=await pluggy('/items/'+encodeURIComponent(info[1]),user,fetcher);return json({id:item.id,status:item.status,lastUpdatedAt:item.lastUpdatedAt,connector:{name:item.connector?.name||'Instituição',id:item.connector?.id}});}
    const item = url.pathname.match(/^\/v1\/pluggy\/items\/([a-zA-Z0-9-]+)\/(accounts|transactions|bills)$/);
    if (!item) return json({ error: 'NOT_FOUND' }, 404);
    const [, itemId, resource] = item;
    if (!Array.isArray(user.itemIds) || !user.itemIds.includes(itemId)) return json({ error: 'FORBIDDEN' }, 403);
    const page=Number(url.searchParams.get('page')||'1');if(!Number.isSafeInteger(page)||page<1||page>500)return json({error:'INVALID_PAGE'},400);
    if(resource==='accounts')return json(await pluggy('/accounts?itemId='+encodeURIComponent(itemId)+'&page='+page+'&pageSize=100',user,fetcher));
    const accountId = url.searchParams.get('accountId');
    if (!accountId || !/^[a-zA-Z0-9-]{1,100}$/.test(accountId)) return json({ error: 'INVALID_ACCOUNT' }, 400);
    const accounts = await pluggy(`/accounts?itemId=${encodeURIComponent(itemId)}`, user, fetcher);
    if (!accounts.results?.some(a => a.id === accountId)) return json({ error: 'FORBIDDEN' }, 403);
    if(resource==='bills')return json(await pluggy('/bills?accountId='+encodeURIComponent(accountId)+'&page='+page+'&pageSize=100',user,fetcher));
    const after=url.searchParams.get('after');if(after&&after.length>2000)return json({error:'INVALID_CURSOR'},400);
    return json(await pluggy('/v2/transactions?accountId='+encodeURIComponent(accountId)+(after?'&after='+encodeURIComponent(after):''),user,fetcher));
  } catch {
    // Não retornar mensagens, credenciais ou corpos de erro do provedor ao cliente.
    return json({ error: 'SERVICE_UNAVAILABLE' }, 503);
  }
}
export async function handle(request,env,fetcher=fetch){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(origin&&origin!==new URL(request.url).origin&&!allowed.includes(origin))return json({error:'ORIGIN_NOT_ALLOWED'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,PUT,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600'}:{}});
 const response=await handleRequest(request,env,fetcher);
 if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
 return response;
}



