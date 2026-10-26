param([switch]$Personal,[string]$Architecture='arm64-v8a')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
if(-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))){throw 'Configure JAVA_HOME apontando para o JDK instalado.'}
if(-not $env:ANDROID_HOME -or -not (Test-Path -LiteralPath $env:ANDROID_HOME)){throw 'Configure ANDROID_HOME apontando para o Android SDK com licenças aceitas.'}
if($Architecture -notin @('arm64-v8a','armeabi-v7a','x86_64')){throw 'Arquitetura não suportada pelo script.'}
$env:EXPO_NO_TELEMETRY='1'
$env:NODE_ENV='production'
Remove-Item Env:EXPO_PUBLIC_WORKER_URL -ErrorAction SilentlyContinue
$env:GRADLE_USER_HOME=Join-Path $project '.gradle-local'
$env:TEMP=Join-Path $project '.expo\export-temp'
$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
if(-not (Test-Path -LiteralPath '.private\android-signing\signing.json')){node scripts/provision-android-signing.cjs;if($LASTEXITCODE -ne 0){throw 'Falha na preparação da assinatura.'}}
if(-not (Test-Path -LiteralPath '.private\android-signing\financeiro-release.jks')){throw 'Arquivo de assinatura ausente; restaure a chave original.'}
node node_modules/expo/bin/cli prebuild --platform android --no-install
if($LASTEXITCODE -ne 0){throw 'Falha no prebuild Android.'}
$sdk=($env:ANDROID_HOME -replace '\\','/')
Set-Content -LiteralPath 'android\local.properties' -Value ('sdk.dir='+$sdk)
Push-Location -LiteralPath android
try{& .\gradlew.bat assembleRelease --no-daemon --max-workers=2 "-PreactNativeArchitectures=$Architecture";if($LASTEXITCODE -ne 0){throw 'Build Android falhou.'}}finally{Pop-Location}
$source=Join-Path $project 'android\app\build\outputs\apk\release\app-release.apk'
if(-not (Test-Path -LiteralPath $source)){throw 'Gradle não produziu o APK esperado.'}
$output=Join-Path $project 'artifacts'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$version=(Get-Content -LiteralPath app.json -Raw | ConvertFrom-Json).expo.version
$target=Join-Path $output "financeiro-$version-$Architecture.apk"
Copy-Item -LiteralPath $source -Destination $target
Get-FileHash -LiteralPath $target -Algorithm SHA256 | Format-List
Write-Output "APK: $target"


