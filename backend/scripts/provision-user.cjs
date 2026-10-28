const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'.wrangler'),id=process.argv[process.argv.indexOf('--id')+1];
if(!process.argv.includes('--id')||!id||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw Error('Use: node scripts/provision-user.cjs --id seu-nome');
fs.mkdirSync(directory,{recursive:true});const secretFile=path.join(directory,'deploy-secrets.json'),accessFile=path.join(directory,'app-access-'+id+'.json');
const secrets=fs.existsSync(secretFile)?JSON.parse(fs.readFileSync(secretFile,'utf8')):{CREDENTIALS_KEY:crypto.randomBytes(32).toString('base64'),USERS_JSON:'[]'};
const users=JSON.parse(secrets.USERS_JSON);if(users.some(user=>user.id===id)||fs.existsSync(accessFile))throw Error('Esse usuário já foi provisionado; nada foi substituído.');
const token=crypto.randomBytes(32).toString('base64url');users.push({id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),itemIds:[]});secrets.USERS_JSON=JSON.stringify(users);
fs.writeFileSync(secretFile,JSON.stringify(secrets),{mode:0o600});fs.writeFileSync(accessFile,JSON.stringify({token}),{flag:'wx',mode:0o600});
console.log('Material privado criado em .wrangler. O token está em app-access-'+id+'.json. Não compartilhe deploy-secrets.json.');
