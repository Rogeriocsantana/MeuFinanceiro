const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const plugin=require('../plugins/withNativeTheme');
const generated=`package com.roger.financeiro
import android.app.Application
import com.facebook.react.PackageList
class MainApplication : Application() {
  fun getPackages() = PackageList(this).packages.apply {
    add(ExistingPackage())
  }
  override fun onCreate() {
    super.onCreate()
    preserveCustomInitialization()
    loadReactNative(this)
    preserveApplicationLifecycle()
  }
}`;
function assertPatch(source){const once=plugin.patchMainApplication(source),twice=plugin.patchMainApplication(once);assert.equal(once,twice);assert.equal((once.match(/add\(FinanceiroThemePreferencesPackage\(\)\)/g)||[]).length,1);assert.equal((once.match(/FinanceiroThemePreferencesModule\.applySavedMode\(this\)/g)||[]).length,1);assert.ok(once.indexOf('FinanceiroThemePreferencesModule.applySavedMode(this)')<once.indexOf('loadReactNative(this)'));return once;}
test('plugin tema nativo recompõe MainApplication gerado e é idempotente',()=>{const result=assertPatch(generated);assert.ok(result.includes('add(ExistingPackage())'));assert.ok(result.includes('preserveCustomInitialization()'));assert.ok(result.includes('preserveApplicationLifecycle()'));assert.match(result,/super\.onCreate\(\)\n    \/\/ @generated begin financeiro-native-theme/);});
test('plugin aceita MainApplication atual sem duplicar implementação manual',()=>{const file='android/app/src/main/java/com/roger/financeiro/MainApplication.kt',current=fs.existsSync(file)?fs.readFileSync(file,'utf8'):plugin.patchMainApplication(generated),result=assertPatch(current);assert.ok(result.includes('loadReactNative(this)'));if(current.includes('ApplicationLifecycleDispatcher.onApplicationCreate(this)'))assert.ok(result.includes('ApplicationLifecycleDispatcher.onApplicationCreate(this)'));});
test('templates persistem preferência visual e informam tema do splash sem recreação explícita',()=>{for(const name of ['FinanceiroThemePreferencesModule.kt','FinanceiroThemePreferencesPackage.kt']){const template=fs.readFileSync(path.join('plugins/native-theme',name),'utf8');assert.match(template,/package com\.roger\.financeiro/);const actual=path.join('android/app/src/main/java/com/roger/financeiro',name);if(fs.existsSync(actual))assert.equal(template,fs.readFileSync(actual,'utf8'));}const module=fs.readFileSync('plugins/native-theme/FinanceiroThemePreferencesModule.kt','utf8');assert.match(module,/Context\.MODE_PRIVATE/);assert.match(module,/"hasSavedMode"/);assert.match(module,/"themeMode"/);assert.doesNotMatch(module,/\.recreate\(/);assert.match(module,/Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.S/);assert.match(module,/setApplicationNightMode\(/);assert.match(module,/AppCompatDelegate\.setDefaultNightMode\(/);assert.match(module,/mode != "light" && mode != "dark"/);});
test('manifest preserva configurações existentes e trata uiMode sem recriar Activity',()=>{const manifest={manifest:{application:[{activity:[{$:{'android:name':'.MainActivity','android:configChanges':'keyboard|orientation'}}]}]}};plugin.ensureUiModeHandling(manifest);plugin.ensureUiModeHandling(manifest);assert.equal(manifest.manifest.application[0].activity[0].$['android:configChanges'],'keyboard|orientation|uiMode');assert.throws(()=>plugin.ensureUiModeHandling({manifest:{}}),/MainActivity/);});
test('plugin falha explicitamente se contrato nativo mudou',()=>{assert.throws(()=>plugin.patchMainApplication('package another\nclass MainApplication {}'),/loadReactNative/);});

test('plugin garante uiMode sem perder outros configChanges nem duplicar flag',()=>{const manifest={manifest:{application:[{activity:[{$:{'android:name':'.MainActivity','android:configChanges':'keyboard|orientation'}}]}]}};const once=JSON.stringify(plugin.ensureUiModeHandling(manifest));assert.equal(JSON.stringify(plugin.ensureUiModeHandling(manifest)),once);assert.equal(manifest.manifest.application[0].activity[0].$['android:configChanges'],'keyboard|orientation|uiMode');});
