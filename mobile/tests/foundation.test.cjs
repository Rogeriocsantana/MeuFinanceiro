const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const ts=require('typescript');
function load(file, replacements={}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module',code)(name=>replacements[name]||(name==='./cloudPreferences'?load('src/data/cloudPreferences.ts'):require(name)),mod.exports,mod);
 return mod.exports;
}
test('banco mantém centavos, vínculos, outbox e revisões na mesma transação',()=>{
 const {SCHEMA}=load('src/data/schema.ts');
 const db=new DatabaseSync(':memory:');db.exec(SCHEMA);
 db.exec("BEGIN; INSERT INTO entries(id,description,amount_cents,purchase_date,person_id,category_id,updated_at) VALUES ('t','Teste',-28450,'2026-10-15','aline','sites','now'); INSERT INTO outbox VALUES('op','entries','t',0,'{}','now'); UPDATE local_meta SET value=value+1 WHERE key='revision'; COMMIT;");
 assert.equal(db.prepare('SELECT amount_cents FROM entries').get().amount_cents,-28450);
 assert.equal(db.prepare('SELECT person_id FROM entries').get().person_id,'aline');
 assert.throws(()=>db.exec("BEGIN; INSERT INTO outbox VALUES('op','entries','t',0,'{}','now');")); db.exec('ROLLBACK');
 assert.equal(db.prepare("SELECT value FROM local_meta WHERE key='revision'").get().value,1);
 const snapshot=new DatabaseSync(':memory:');snapshot.exec(SCHEMA);
 // A conclusão de r1 não pode confirmar alterações de r2.
 db.exec("UPDATE local_meta SET value=2 WHERE key='revision'; UPDATE local_meta SET value=MAX(value,1) WHERE key='backed_up_revision';");
 assert.equal(db.prepare("SELECT value FROM local_meta WHERE key='backed_up_revision'").get().value,1);
 db.close();snapshot.close();
});
test('backup criptografado recupera bytes e rejeita senha errada e adulteração',async()=>{
 const {encryptBackup,decryptBackup}=load('src/services/backup-crypto.ts',{'expo-crypto':{getRandomBytes:n=>require('node:crypto').randomBytes(n)}});
 const bytes=new Uint8Array([83,81,76,105,116,101,0,255]);
 const text=await encryptBackup(bytes,'minha-senha-de-recuperacao',1);
 assert.deepEqual(await decryptBackup(text,'minha-senha-de-recuperacao'),bytes);
 await assert.rejects(decryptBackup(text,'senha-incorreta'));
 const bad=JSON.parse(text);const raw=Buffer.from(bad.ciphertext,'base64');raw[0]^=1;bad.ciphertext=raw.toString('base64');
 await assert.rejects(decryptBackup(JSON.stringify(bad),'minha-senha-de-recuperacao'));
});
