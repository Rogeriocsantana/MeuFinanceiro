package com.roger.financeiro

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

class FinanceiroUpdater(private val context: ReactApplicationContext): ReactContextBaseJavaModule(context) {
 override fun getName() = "FinanceiroUpdater"
 @ReactMethod fun install(url: String, sha256: String, code: Double, size: Double, promise: Promise) {
  if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
   context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
   promise.resolve("permission"); return
  }
  Thread {
   try {
    require(url.startsWith("https://github.com/Rogeriocsantana/MeuFinanceiro/releases/download/")) { "Origem inválida" }
    require(sha256.matches(Regex("[a-fA-F0-9]{64}")) && size > 0 && size <= 209715200) { "Arquivo inválido" }
    var target = URL(url)
    var connection: HttpURLConnection? = null
    for (redirect in 0..5) {
     require(target.protocol == "https" && target.userInfo == null && (target.port == -1 || target.port == 443) && target.host in listOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")) { "Redirecionamento inválido" }
     val current = target.openConnection() as HttpURLConnection
     current.instanceFollowRedirects = false; current.connectTimeout = 20000; current.readTimeout = 30000
     val status = current.responseCode
     if (status in listOf(301,302,303,307,308)) { val location=current.getHeaderField("Location"); current.disconnect(); require(location != null); target=URL(target,location) } else { require(status==200) { "Falha no download: $status" }; connection=current; break }
    }
    val download = requireNotNull(connection) { "Muitos redirecionamentos" }
    val folder=File(context.cacheDir,"updates"); folder.mkdirs()
    val file=File(folder,"financeiro.apk")
    val digest=MessageDigest.getInstance("SHA-256")
    var count=0L
    try { download.inputStream.use { input -> file.outputStream().use { output -> val buffer=ByteArray(65536); while(true) { val n=input.read(buffer); if(n<0)break; count+=n; require(count<=size.toLong()) { "Tamanho inválido" }; digest.update(buffer,0,n); output.write(buffer,0,n) } } } } finally { download.disconnect() }
    require(count==size.toLong() && digest.digest().joinToString("") { "%02x".format(it) }.equals(sha256,true)) { "Integridade da atualização não confirmada" }
    @Suppress("DEPRECATION")
    val archive=requireNotNull(context.packageManager.getPackageArchiveInfo(file.absolutePath,PackageManager.GET_SIGNATURES))
    @Suppress("DEPRECATION")
    val installed=context.packageManager.getPackageInfo(context.packageName,PackageManager.GET_SIGNATURES)
    @Suppress("DEPRECATION")
    require(archive.packageName==context.packageName && archive.versionCode.toDouble()==code && archive.versionCode>installed.versionCode && archive.signatures?.map { it.toCharsString() }?.toSet()==installed.signatures?.map { it.toCharsString() }?.toSet()) { "Identidade ou assinatura da atualização inválida" }
    val uri=FileProvider.getUriForFile(context,context.packageName+".updates",file)
    context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION))
    promise.resolve("installer")
   } catch(e: Exception) { File(context.cacheDir,"updates/financeiro.apk").delete(); promise.reject("UPDATE_FAILED",e.message,e) }
  }.start()
 }
}
class FinanceiroUpdaterPackage: ReactPackage {
 override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FinanceiroUpdater(context))
 override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
