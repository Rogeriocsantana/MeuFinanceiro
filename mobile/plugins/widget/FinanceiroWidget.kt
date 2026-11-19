package com.roger.financeiro

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class FinanceiroWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { render(context, manager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    render(context, manager, id)
  }

  override fun onDeleted(context: Context, ids: IntArray) {
    val editor = prefs(context).edit()
    ids.forEach { editor.remove("agenda:$it").remove("hidden:$it") }
    editor.apply()
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    val action = intent.action ?: return
    val operation = action.substringBefore(':')
    if (operation !in listOf("summary", "agenda", "privacy")) return
    val id = action.substringAfter(':').toIntOrNull() ?: return
    val manager = AppWidgetManager.getInstance(context)
    if (id !in manager.getAppWidgetIds(android.content.ComponentName(context, FinanceiroWidget::class.java))) return
    val state = prefs(context)
    val edit = state.edit()
    if (operation == "privacy") edit.putBoolean("hidden:$id", !state.getBoolean("hidden:$id", true))
    else edit.putBoolean("agenda:$id", operation == "agenda")
    edit.apply()
    render(context, manager, id)
  }

  companion object {
    private fun prefs(context: Context) = context.getSharedPreferences("financeiro_widget", Context.MODE_PRIVATE)

    fun publish(context: Context, json: String) {
      prefs(context).edit().putString("snapshot", json).apply()
      val manager = AppWidgetManager.getInstance(context)
      val component = android.content.ComponentName(context, FinanceiroWidget::class.java)
      manager.getAppWidgetIds(component).forEach { render(context, manager, it) }
    }

    private fun render(context: Context, manager: AppWidgetManager, id: Int) {
      val state = prefs(context)
      val agenda = state.getBoolean("agenda:$id", false)
      val hidden = state.getBoolean("hidden:$id", true)
      val snapshot = runCatching { JSONObject(state.getString("snapshot", "{}") ?: "{}") }.getOrElse { JSONObject() }
      val available = snapshot.has("pay")
      val views = RemoteViews(context.packageName, R.layout.financeiro_widget)
      val options = manager.getAppWidgetOptions(id)
      val landscape = context.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
      val width = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
      val height = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
      val wide = width >= 300
      val rowCount = ((height - 144) / 40).coerceIn(3, 6).let {
        if (height > 0) it else 3
      }
      if (wide) {
        views.setTextViewTextSize(R.id.widget_balance, TypedValue.COMPLEX_UNIT_SP, 38f)
        views.setTextViewTextSize(R.id.widget_pay, TypedValue.COMPLEX_UNIT_SP, 22f)
        views.setTextViewTextSize(R.id.widget_receive, TypedValue.COMPLEX_UNIT_SP, 22f)
      }
      fun action(operation: String) = PendingIntent.getBroadcast(
        context, 0, Intent(context, FinanceiroWidget::class.java).setAction("$operation:$id"),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      fun amount(key: String) = if (!snapshot.has(key)) "—" else if (hidden) "••••" else snapshot.optString(key)
      views.setTextViewText(R.id.widget_title, if (agenda) "Agenda financeira" else "Saldo em contas")
      views.setTextViewText(R.id.widget_period, if (!available) "Abra o Financeiro para atualizar" else if (agenda) "Próximos compromissos" else snapshot.optString("month"))
      views.setTextViewText(R.id.widget_balance, amount("balance"))
      views.setViewVisibility(R.id.widget_summary, if (agenda) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.widget_agenda, if (agenda) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_pay, amount("pay"))
      views.setTextViewText(R.id.widget_receive, amount("receive"))
      views.setImageViewResource(R.id.widget_eye, if (hidden) R.drawable.financeiro_widget_eye_off else R.drawable.financeiro_widget_eye)
      views.setContentDescription(R.id.widget_eye, if (hidden) "Mostrar valores" else "Ocultar valores")
      views.setOnClickPendingIntent(R.id.widget_eye, action("privacy"))
      views.setOnClickPendingIntent(R.id.widget_summary_button, action("summary"))
      views.setOnClickPendingIntent(R.id.widget_agenda_button, action("agenda"))
      views.setImageViewResource(R.id.widget_summary_button, if (!agenda) R.drawable.financeiro_widget_summary_active else R.drawable.financeiro_widget_summary)
      views.setImageViewResource(R.id.widget_agenda_button, if (agenda) R.drawable.financeiro_widget_agenda_active else R.drawable.financeiro_widget_agenda)
      val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      views.setOnClickPendingIntent(R.id.widget_brand, PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE))
      views.removeAllViews(R.id.widget_agenda)
      val entries = snapshot.optJSONArray("entries")
      if (agenda && available && (entries == null || entries.length() == 0)) {
        val row = RemoteViews(context.packageName, R.layout.financeiro_widget_row)
        row.setTextViewText(R.id.widget_row_name, "Nenhum compromisso previsto")
        views.addView(R.id.widget_agenda, row)
      }
      if (agenda && entries != null) for (index in 0 until minOf(rowCount, entries.length())) {
        val entry = entries.optJSONObject(index) ?: continue
        val row = RemoteViews(context.packageName, R.layout.financeiro_widget_row)
        row.setTextViewText(R.id.widget_row_name, if (hidden) entry.optString("direction") else entry.optString("name"))
        row.setTextViewText(R.id.widget_row_date, entry.optString("date") + if (hidden) "" else " · " + entry.optString("direction"))
        row.setTextViewText(R.id.widget_row_amount, if (hidden) "••••" else entry.optString("amount"))
        if (wide) {
          row.setTextViewTextSize(R.id.widget_row_name, TypedValue.COMPLEX_UNIT_SP, 17f)
          row.setTextViewTextSize(R.id.widget_row_date, TypedValue.COMPLEX_UNIT_SP, 13f)
          row.setTextViewTextSize(R.id.widget_row_amount, TypedValue.COMPLEX_UNIT_SP, 17f)
        }
        if (entry.optString("direction") == "A receber") row.setTextColor(R.id.widget_row_amount, 0xFF91DFB8.toInt())
        views.addView(R.id.widget_agenda, row)
      }
      manager.updateAppWidget(id, views)
    }
  }
}
