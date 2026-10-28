const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync('src/services/appRelease.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m.exports,m);
const {parseRelease}=m.exports;
const manifest={packageName:'com.roger.financeiro',version:'0.3.39',versionCode:40,apkAssetName:'financeiro.apk',size:100,sha256:'a'.repeat(64)};
const release={assets:[{name:'financeiro.apk',size:100,browser_download_url:'https://github.com/Rogeriocsantana/MeuFinanceiro/releases/download/v0.3.39/financeiro.apk'}]};
test('atualização exige versão maior e identidade correta',()=>{assert.equal(parseRelease(release,manifest,39).versionCode,40);assert.equal(parseRelease(release,manifest,40),null);assert.equal(parseRelease(release,{...manifest,packageName:'outro'},39),null);assert.equal(parseRelease({...release,prerelease:true},manifest,39),null);});
test('atualização rejeita origem externa, tamanho e digest inválidos',()=>{assert.throws(()=>parseRelease({...release,assets:[{...release.assets[0],browser_download_url:'https://example.com/a.apk'}]},manifest,39));assert.throws(()=>parseRelease(release,{...manifest,size:99},39));assert.throws(()=>parseRelease(release,{...manifest,sha256:'x'.repeat(64)},39));});
test('consulta funciona com AbortController do Android sem AbortSignal.timeout e informa erros HTTP',async()=>{
 const original={AbortController:global.AbortController,AbortSignal:global.AbortSignal,fetch:global.fetch};
 const {createRequire}=require('node:module'),path=require('node:path');
 const requireNative=createRequire(fs.realpathSync(require.resolve('react-native/package.json')));
 const nativeAbort=requireNative('abort-controller');
 try{
  global.AbortController=nativeAbort.AbortController;global.AbortSignal=nativeAbort.AbortSignal;assert.equal(typeof global.AbortSignal.timeout,'undefined');
  const urls=[];global.fetch=async(url,options)=>{urls.push(url);assert.ok(options.signal);return {ok:true,status:200,json:async()=>url.includes('api.github.com')?{...release,assets:[...release.assets,{name:'update.json',browser_download_url:'https://github.com/Rogeriocsantana/MeuFinanceiro/releases/download/v0.3.39/update.json'}]}:manifest};};
  assert.equal((await m.exports.latestRelease(39)).versionCode,40);assert.equal(urls.length,2);
  global.fetch=async()=>({ok:false,status:403});await assert.rejects(()=>m.exports.latestRelease(39),/HTTP 403/);
  global.fetch=async()=>({ok:false,status:404});assert.equal(await m.exports.latestRelease(39),null);
 }finally{Object.assign(global,original);}
});
