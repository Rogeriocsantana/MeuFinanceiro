const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),apk=path.resolve(process.argv[2]||path.join(root,'artifacts/financeiro-'+JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8').replace(/^\uFEFF/,'')).expo.version+'-arm64-v8a.apk'));
if(!process.env.ANDROID_HOME||!process.env.JAVA_HOME)throw Error('Configure ANDROID_HOME e JAVA_HOME.');
const tools=path.join(process.env.ANDROID_HOME,'build-tools',process.env.ANDROID_BUILD_TOOLS_VERSION||'36.0.0');
function run(executable,args){const result=spawnSync(executable,args,{encoding:'utf8',shell:executable.endsWith('.bat')});if(result.status!==0)throw Error('Falha na verificação '+path.basename(executable));return result.stdout;}
if(!fs.existsSync(apk))throw Error('APK não encontrado.');
const signature=run(path.join(process.env.JAVA_HOME,'bin/java.exe'),['-jar',path.join(tools,'lib/apksigner.jar'),'verify','--verbose','--print-certs',apk]);
const badging=run(path.join(tools,'aapt.exe'),['dump','badging',apk]);
const manifest=run(path.join(tools,'aapt.exe'),['dump','xmltree',apk,'AndroidManifest.xml']);
if(!badging.includes("name='com.roger.financeiro'"))throw Error('Identidade do APK inesperada.');
const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
if(!badging.includes("versionName='"+app.version+"'")||!badging.includes("versionCode='"+app.android.versionCode+"'"))throw Error('Versão do APK divergente.');
for(const permission of ['POST_NOTIFICATIONS','RECEIVE_BOOT_COMPLETED','WAKE_LOCK','VIBRATE','REQUEST_INSTALL_PACKAGES'])if(!badging.includes("name='android.permission."+permission+"'"))throw Error('Permissão necessária ausente: '+permission);
for(const component of ['expo.modules.notifications','androidx.work.impl.background.systemjob.SystemJobService'])if(!manifest.includes(component))throw Error('Componente nativo necessário ausente: '+component);
if(/application-debuggable/.test(badging))throw Error('APK está marcado como depurável.');
for(const permission of ['RECORD_AUDIO','SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE'])if(badging.includes("name='android.permission."+permission+"'"))throw Error('Permissão indevida: '+permission);
for(const flag of ['allowBackup','usesCleartextTraffic'])if(!new RegExp('android:'+flag+'[^\\n]*\\(type 0x12\\)0x0').test(manifest))throw Error('Proteção não confirmada: '+flag);
if(!badging.includes("native-code: 'arm64-v8a'"))throw Error('Arquitetura inesperada.');
const fingerprint=signature.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1];if(!fingerprint)throw Error('Certificado não identificado.');
const signing=JSON.parse(fs.readFileSync(path.join(root,'.private/android-signing/signing.json'),'utf8'));
const keytool=path.join(process.env.JAVA_HOME,'bin/keytool.exe');
const certificate=spawnSync(keytool,['-exportcert','-rfc','-alias',signing.keyAlias,'-keystore',path.join(root,'.private/android-signing/financeiro-release.jks'),'-storepass:env','FINANCEIRO_VERIFY_PASSWORD'],{encoding:'utf8',env:{...process.env,FINANCEIRO_VERIFY_PASSWORD:signing.storePassword}});
if(certificate.status!==0)throw Error('Não foi possível conferir a chave original.');
const expected=new crypto.X509Certificate(certificate.stdout).fingerprint256.replaceAll(':','').toLowerCase();if(expected!==fingerprint.toLowerCase())throw Error('APK não usa a assinatura original.');
const bytes=fs.readFileSync(apk),evidence={apk,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),certificateSha256:fingerprint,package:'com.roger.financeiro',architecture:'arm64-v8a',release:true,allowBackup:false,cleartext:false,signatureVerified:true,verifiedAt:new Date().toISOString()};
fs.writeFileSync(apk+'.verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));




