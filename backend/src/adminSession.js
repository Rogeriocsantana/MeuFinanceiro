const cookieName='__Secure-financeiro_admin',ticketTTL=60,sessionTTL=900;
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const cookie=value=>cookieName+'='+value+'; Path=/v1/admin; HttpOnly; Secure; SameSite=Strict; Max-Age='+sessionTTL;
const cookieToken=request=>request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
function eligible(env,row){const user=JSON.parse(env.USERS_JSON||'[]').find(u=>u.id===row.user_id&&!u.disabled&&u.tokenHash===row.credential_hash);return user&&user.id===env.ADMIN_USER_ID?user:null;}
export async function issueBrowserTicket(request,env,user,hashToken){
 if(!user||user.managed||user.id!==env.ADMIN_USER_ID)return json({error:'FORBIDDEN'},403);
 if(!env.DB)return json({error:'ADMIN_NOT_CONFIGURED'},409);
 const now=Math.floor(Date.now()/1000),ticket=random();await env.DB.batch([env.DB.prepare('DELETE FROM admin_browser_sessions WHERE expires_at<=?').bind(now),env.DB.prepare('INSERT INTO admin_browser_sessions VALUES(?,?,?,?,?)').bind(await hashToken(ticket),'ticket',user.id,user.tokenHash,now+ticketTTL)]);
 return json({path:'/admin#handoff='+ticket,expiresIn:ticketTTL});
}
export async function redeemBrowserTicket(request,env,hashToken){
 if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'ORIGIN_NOT_ALLOWED'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'INVALID_CONTENT_TYPE'},415);
 const chunks=[];let size=0;const reader=request.body?.getReader();if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512){await reader.cancel();return json({error:'INVALID_TICKET'},400);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const raw=new TextDecoder().decode(bytes);let ticket;try{ticket=JSON.parse(raw).ticket;}catch{return json({error:'INVALID_TICKET'},400);}
 if(typeof ticket!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(ticket)||!env.DB)return json({error:'UNAUTHORIZED'},401);
 const now=Math.floor(Date.now()/1000),row=await env.DB.prepare("DELETE FROM admin_browser_sessions WHERE token_hash=? AND kind='ticket' AND expires_at>? RETURNING user_id,credential_hash").bind(await hashToken(ticket),now).first();
 if(!row||!eligible(env,row))return json({error:'UNAUTHORIZED'},401);
 const session=random();await env.DB.batch([env.DB.prepare('INSERT INTO admin_browser_sessions VALUES(?,?,?,?,?)').bind(await hashToken(session),'session',row.user_id,row.credential_hash,now+sessionTTL)]);
 return json({authenticated:true},200,{'Set-Cookie':cookie(session),'Referrer-Policy':'no-referrer'});
}
export async function browserSessionUser(request,env,hashToken){
 const token=cookieToken(request);if(! /^[A-Za-z0-9_-]{43}$/.test(token)||!env.DB)return null;
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==new URL(request.url).origin)return null;
 const row=await env.DB.prepare("SELECT user_id,credential_hash FROM admin_browser_sessions WHERE token_hash=? AND kind='session' AND expires_at>?").bind(await hashToken(token),Math.floor(Date.now()/1000)).first();return row?eligible(env,row):null;
}
export async function logoutBrowser(request,env,hashToken){
 const token=cookieToken(request);if(token&&env.DB)await env.DB.batch([env.DB.prepare("DELETE FROM admin_browser_sessions WHERE token_hash=? AND kind='session'").bind(await hashToken(token))]);
 return json({authenticated:false},200,{'Set-Cookie':cookieName+'=; Path=/v1/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
}
