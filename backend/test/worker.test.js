import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, hashToken } from '../src/worker.js';
const token = 'a'.repeat(43);
const env = { USERS_JSON: JSON.stringify([{ id: 'roger', tokenHash: await hashToken(token), itemIds: ['mine'], pluggyClientId: 'client', pluggyClientSecret: 'secret' }]) };
const req = path => new Request(`https://example.test${path}`, { headers: { Authorization: `Bearer ${token}` } });
test('nega acesso sem autenticação', async () => assert.equal((await handle(new Request('https://example.test/v1/me'), env)).status, 401));
test('isola items entre usuários antes de chamar provedor', async () => {
  const result = await handle(req('/v1/pluggy/items/other/accounts'), env, () => { throw new Error('Não deve chamar'); });
  assert.equal(result.status, 403);
});
test('não retorna credenciais no perfil', async () => {
  assert.deepEqual(await (await handle(req('/v1/me'), env)).json(), { id: 'roger', itemIds: ['mine'] });
});
test('nega conta de outro item', async () => {
  const result = await handle(req('/v1/pluggy/items/mine/transactions?accountId=other'), env, async url => new Response(JSON.stringify(url.endsWith('/auth') ? { apiKey: 'provider-secret' } : { results: [{ id: 'account-mine' }] })));
  assert.equal(result.status, 403);
});
test('erro do provedor não vaza segredo', async () => {
  const result = await handle(req('/v1/pluggy/items/mine/accounts'), env, async () => { throw new Error('secret'); });
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: 'SERVICE_UNAVAILABLE' });
});

test('cursor V2 preservado sem parâmetro pageSize não suportado',async()=>{const paths=[];const result=await handle(req('/v1/pluggy/items/mine/transactions?accountId=account-mine&after=abc%3D'),env,async url=>{paths.push(url);return new Response(JSON.stringify(url.endsWith('/auth')?{apiKey:'secret'}:url.includes('/accounts?')?{results:[{id:'account-mine'}]}:{results:[],next:null}));});assert.equal(result.status,200);assert.ok(paths.some(p=>p.endsWith('/v2/transactions?accountId=account-mine&after=abc%3D')));});
test('faturas também verificam propriedade da conta',async()=>{const result=await handle(req('/v1/pluggy/items/mine/bills?accountId=foreign'),env,async url=>new Response(JSON.stringify(url.endsWith('/auth')?{apiKey:'secret'}:{results:[]})));assert.equal(result.status,403);});
