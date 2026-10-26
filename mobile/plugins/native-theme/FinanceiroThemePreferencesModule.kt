package com.roger.financeiro

import android.content.Context
import android.app.UiModeManager
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/** Persists the visual preference both locally and in Android's launch-screen configuration. */
@ReactModule(name = FinanceiroThemePreferencesModule.NAME)
class FinanceiroThemePreferencesModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
    "themeMode" to savedMode(reactApplicationContext),
    "hasSavedMode" to hasSavedMode(reactApplicationContext)
  )

  @ReactMethod
  fun setMode(mode: String) {
    if (mode != "light" && mode != "dark") return
    // React methods run on the native module queue. Complete the tiny disk write
    // before a later cold start. MainActivity handles uiMode changes itself, so
    // informing Android does not recreate it or discard a form in progress.
    preferences(reactApplicationContext).edit().putString(KEY, mode).commit()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      applySavedMode(reactApplicationContext)
    }
  }

  companion object {
    const val NAME = "FinanceiroThemePreferences"
    private const val FILE = "financeiro_visual_preferences"
    private const val KEY = "themeMode"

    private fun preferences(context: Context) =
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun savedMode(context: Context): String =
      if (preferences(context).getString(KEY, "light") == "dark") "dark" else "light"

    fun hasSavedMode(context: Context): Boolean = preferences(context).contains(KEY)

    fun applySavedMode(context: Context) {
      val dark = savedMode(context) == "dark"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        // The system displays Android 12+'s starting window before Application
        // runs. This persisted per-app mode is required for the next cold start.
        context.getSystemService(UiModeManager::class.java)?.setApplicationNightMode(
          if (dark) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO
        )
      } else {
        AppCompatDelegate.setDefaultNightMode(
          if (dark) AppCompatDelegate.MODE_NIGHT_YES else AppCompatDelegate.MODE_NIGHT_NO
        )
      }
    }
  }
}
