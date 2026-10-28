import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle,hashToken} from '../src/api.js';
import {saveCredentials,readCredentials} from '../src/credentials.js';
function fixture(){
 const sql=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')))sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const values=new Map(),db={prepare(query){return {bind(...args){return {query,args,first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)})};}};},async batch(statements){sql.exec('BEGIN');try{const result=statements.map(s=>sql.prepare(s.query).run(...s.args));sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
 return {sql,values,db};
}
const admin='a'.repeat(43),nonadmin='b'.repeat(43);
const req=(path,token=admin,body)=>new Request('https://worker.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
test('admin cria acesso, baixa JSON cifrado e desativa sem apagar dados; familiares isolados',async()=>{
 const {sql,values,db}=fixture();
 const env={DB:db,ADMIN_USER_ID:'owner',USERS_JSON:JSON.stringify([{id:'owner',tokenHash:await hashToken(admin)},{id:'other',tokenHash:await hashToken(nonadmin)}]),CREDENTIALS_KEY:Buffer.alloc(32,9).toString('base64'),CREDENTIALS:{get:async key=>values.get(key)||null,put:async(key,value)=>values.set(key,value)}};
 try{
  await saveCredentials(env,'owner',{clientId:'owner-id',clientSecret:'owner-secret',itemIds:['owner-item']});const ownerCipher=values.get('pluggy:owner');
  assert.equal((await handle(req('/v1/admin/users',nonadmin),env)).status,403);
  assert.equal((await handle(req('/v1/admin/users','x'.repeat(43)),env)).status,401);
  const created=await handle(req('/v1/admin/users',admin,{name:'Maria'}),env);assert.equal(created.status,201);const maria=await created.json();
  const paulo=await(await handle(req('/v1/admin/users',admin,{name:'Paulo'}),env)).json();
  assert.notEqual(maria.configuration.server.token,paulo.configuration.server.token);
  assert.ok(!JSON.stringify([...values]).includes(maria.configuration.server.token));
  assert.equal(sql.prepare('SELECT token_hash FROM family_access WHERE id=?').get(maria.user.id).token_hash,await hashToken(maria.configuration.server.token));
  const token=maria.configuration.server.token;
  assert.equal((await handle(req('/v1/admin/users',token),env)).status,403);
  const me=await(await handle(req('/v1/me',token),env)).json();assert.equal(me.id,maria.user.id);
  assert.deepEqual(await(await handle(req('/v1/admin/users/'+maria.user.id+'/configuration'),env)).json(),maria.configuration);
  const all=await(await handle(req('/v1/admin/users'),env)).json();assert.equal(all.users.length,2);assert.ok(!JSON.stringify(all).includes(token));
  const provider=async()=>new Response(JSON.stringify({apiKey:'ephemeral'}));
  const put=new Request('https://worker.test/v1/pluggy/config',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({clientId:'maria-id',clientSecret:'maria-secret',itemIds:[]})});assert.equal((await handle(put,env,provider)).status,200);
  assert.equal((await(await handle(req('/v1/connection',paulo.configuration.server.token),env)).json()).pluggyConfigured,false);
  assert.equal((await(await handle(req('/v1/connection',token),env)).json()).pluggyConfigured,true);
  assert.equal(values.get('pluggy:owner'),ownerCipher);assert.equal((await readCredentials(env,maria.user.id)).clientSecret,'maria-secret');assert.equal((await readCredentials(env,'owner')).clientSecret,'owner-secret');
  const operation={operationId:'owner-op',entityType:'annotations',entityId:'same-id',baseVersion:0,payload:{categoryId:'owner-category'},deletedAt:null};
  assert.equal((await handle(req('/v1/sync',admin,operation),env)).status,200);
  assert.deepEqual((await(await handle(req('/v1/sync',token),env)).json()).changes,[]);
  assert.equal((await handle(req('/v1/sync',token,{...operation,operationId:'family-op',payload:{categoryId:'family-category'}}),env)).status,200);
  assert.equal(JSON.parse(sql.prepare('SELECT payload FROM sync_records WHERE user_id=?').get('owner').payload).categoryId,'owner-category');
  assert.equal((await handle(req('/v1/admin/users/'+maria.user.id+'/status',admin,{enabled:false}),env)).status,200);
  assert.equal((await handle(req('/v1/me',token),env)).status,401);
  assert.equal((await handle(req('/v1/admin/users/'+maria.user.id+'/configuration'),env)).status,409);
  assert.ok(values.has('pluggy:'+maria.user.id));
  await handle(req('/v1/admin/users/'+maria.user.id+'/status',admin,{enabled:true}),env);
  assert.equal((await handle(req('/v1/me',token),env)).status,200);
 }finally{sql.close();}
});
test('página admin não contém credenciais e exige autenticação na API',async()=>{
 const response=await handle(new Request('https://worker.test/admin'),{});assert.equal(response.status,200);assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.ok(!(await response.text()).includes(admin));
 assert.equal((await handle(new Request('https://worker.test/v1/admin/users'),{})).status,401);
});

