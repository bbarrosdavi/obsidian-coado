package br.app.coado.shared.timer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.app.coado.shared.CoadoCore
import kotlinx.coroutines.launch

/** O alarme do fim da etapa e os botões da notificação (pausar, pular) */
class TimerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val app = CoadoCore.of(context)
        val result = goAsync()
        app.scope.launch {
            try {
                when (intent.action) {
                    ACTION_ALARM -> app.engine.onAlarm()
                    ACTION_TOGGLE -> app.engine.toggle()
                    ACTION_SKIP -> app.engine.skip()
                }
            } finally {
                result.finish()
            }
        }
    }

    companion object {
        const val ACTION_ALARM = "br.app.coado.timer.ALARM"
        const val ACTION_TOGGLE = "br.app.coado.timer.TOGGLE"
        const val ACTION_SKIP = "br.app.coado.timer.SKIP"

        fun pending(context: Context, action: String): PendingIntent = PendingIntent.getBroadcast(
            context,
            action.hashCode(),
            Intent(context, TimerReceiver::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}

/** Depois do boot ou de atualizar o app: o alarme se perde, a sessão guardada não */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val app = CoadoCore.of(context)
        val result = goAsync()
        app.scope.launch {
            try {
                app.engine.restore()
            } finally {
                result.finish()
            }
        }
    }
}
