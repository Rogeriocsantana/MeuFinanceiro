const {withAndroidManifest,withAppBuildGradle}=require('expo/config-plugins');
module.exports=config=>{
 config=withAndroidManifest(config,mod=>{mod.modResults.manifest.application[0].$['android:usesCleartextTraffic']='false';return mod;});
 if(process.env.EAS_BUILD==='true')return config;
 return withAppBuildGradle(config,mod=>{
  // Credentials live in a local ignored file, never in Gradle/source/APK.
  const signing=`
def financeiroSigningFile = rootProject.file('../.private/android-signing/signing.json')
def financeiroSigning = financeiroSigningFile.exists() ? new groovy.json.JsonSlurper().parse(financeiroSigningFile) : null
`;
  let s=mod.modResults.contents;
  if(s.includes("def financeiroSigningFile"))return mod;
  s=signing+s;
  s=s.replace('signingConfigs {',`signingConfigs {
        if (financeiroSigning != null) {
            release {
                storeFile rootProject.file('../.private/android-signing/financeiro-release.jks')
                storePassword financeiroSigning.storePassword
                keyAlias financeiroSigning.keyAlias
                keyPassword financeiroSigning.keyPassword
            }
        }`);
  s=s.replace(/(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs.debug/,`$1signingConfig(financeiroSigning != null ? signingConfigs.release : signingConfigs.debug)`);
  // Refuse a local release with the public debug key. EAS may inject its own
  // signing through its supported credentials mechanism.
  s+=`\ngradle.taskGraph.whenReady { graph ->
    if (graph.allTasks.any { it.name == 'packageRelease' } && financeiroSigning == null && System.getenv('EAS_BUILD') != 'true') {
        throw new GradleException('Gere a assinatura privada com scripts/provision-android-signing.cjs antes do APK release.')
    }
}\n`;
  mod.modResults.contents=s;return mod;
 });
};
