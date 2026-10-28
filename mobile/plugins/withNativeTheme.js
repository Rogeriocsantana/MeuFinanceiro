const fs = require('node:fs/promises');
const path = require('node:path');

const BEGIN = '    // @generated begin financeiro-native-theme';
const END = '    // @generated end financeiro-native-theme';
const themeBlock = [BEGIN,
  '    FinanceiroThemePreferencesModule.applySavedMode(this)', END].join('\n');

function patchMainApplication(contents) {
  let source = contents.replace(/\r\n/g, '\n');
  if (!source.includes('loadReactNative(this)')) throw new Error('Native theme: MainApplication does not expose loadReactNative(this).');
  if (!/add\(FinanceiroThemePreferencesPackage\(\)\)/.test(source)) {
    const packages = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (!packages.test(source)) throw new Error('Native theme: React package list not found.');
    source = source.replace(packages, match => match + '\n              add(FinanceiroThemePreferencesPackage())');
  }
  // Accept both a previous plugin run and the initial hand-written implementation.
  source = source.replace(/    \/\/ @generated begin financeiro-native-theme\n[\s\S]*?    \/\/ @generated end financeiro-native-theme\n?/g, '');
  source = source.replace(/^[ \t]*AppCompatDelegate\.setDefaultNightMode\(\s*\n[ \t]*if \(FinanceiroThemePreferencesModule\.savedMode\(this\) == "dark"\)\s*\n[ \t]*AppCompatDelegate\.MODE_NIGHT_YES\s*\n[ \t]*else AppCompatDelegate\.MODE_NIGHT_NO\s*\n[ \t]*\)\n?/gm, '');
  source = source.replace(/^[ \t]*FinanceiroThemePreferencesModule\.applySavedMode\(this\)\n?/gm, '');
  if (!source.includes('AppCompatDelegate.')) source = source.replace(/^import androidx\.appcompat\.app\.AppCompatDelegate\n/gm, '');
  const applicationCreate = /override fun onCreate\(\)\s*\{\s*\n[ \t]*super\.onCreate\(\)/;
  if (!applicationCreate.test(source)) throw new Error('Native theme: Application onCreate hook not found.');
  source = source.replace(applicationCreate, match => match + '\n' + themeBlock);
  if (source.indexOf(BEGIN) > source.indexOf('loadReactNative(this)')) throw new Error('Native theme must initialize before React Native.');
  return source;
}

function ensureUiModeHandling(manifest) {
  const activity = manifest.manifest.application?.[0]?.activity?.find(item => item.$?.['android:name'] === '.MainActivity');
  if (!activity) throw new Error('Native theme: MainActivity manifest entry not found.');
  const changes = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
  if (!changes.includes('uiMode')) changes.push('uiMode');
  activity.$['android:configChanges'] = changes.join('|');
  return manifest;
}

function withNativeTheme(config) {
  const {withMainApplication, withDangerousMod, withAndroidManifest} = require('expo/config-plugins');
  config = withAndroidManifest(config, mod => {
    mod.modResults = ensureUiModeHandling(mod.modResults);
    return mod;
  });
  config = withMainApplication(config, mod => {
    if (mod.modResults.language !== 'kt') throw new Error('Native theme requires Kotlin MainApplication.');
    mod.modResults.contents = patchMainApplication(mod.modResults.contents);
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const destination = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/java/com/roger/financeiro');
    await fs.mkdir(destination, {recursive: true});
    for (const name of ['FinanceiroThemePreferencesModule.kt', 'FinanceiroThemePreferencesPackage.kt']) {
      await fs.copyFile(path.join(__dirname, 'native-theme', name), path.join(destination, name));
    }
    return mod;
  }]);
}

module.exports = withNativeTheme;
module.exports.patchMainApplication = patchMainApplication;
module.exports.ensureUiModeHandling = ensureUiModeHandling;

