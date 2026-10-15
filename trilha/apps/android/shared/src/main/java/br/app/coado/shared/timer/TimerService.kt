package br.app.coado.shared.timer

import br.app.coado.shared.Marca
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.R
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.fmtClock

/**
 * A sessão em andamento como notificação fixa. O serviço não conta tempo: a contagem da
 * notificação é do sistema (cronômetro regressivo) e o fim da etapa é um alarme. Ele existe para a
 * notificação não ser descartável e para o relógio prender a atividade em andamento a ela.
 */
class TimerService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val app = CoadoCore.of(this)
        val state = app.store.timer.value
        if (!state.active || intent?.action == ACTION_STOP) {
            // chegou pelo startForegroundService: precisa passar pelo startForeground antes de sair
            goForeground(notification(app, state, System.currentTimeMillis()))
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        goForeground(notification(app, state, System.currentTimeMillis()))
        return START_NOT_STICKY
    }

    private fun goForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ID, notification)
        }
    }

    private fun notification(app: CoadoCore, state: TimerState, now: Long): Notification {
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.channel_timer), NotificationManager.IMPORTANCE_LOW).apply {
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            },
        )
        val open = PendingIntent.getActivity(this, 0, app.timerIntent(), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val phase = if (state.mode == Mode.FREE) "Livre" else state.phase.label
        val builder = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_trail)
            .setContentTitle(state.subjectName.ifBlank { Marca.NOME })
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        if (state.running && state.mode == Mode.POMODORO) {
            // o sistema desenha a contagem regressiva: nada acorda o processo
            builder.setContentText(phase)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(state.phaseEndAt ?: now)
                .setShowWhen(true)
        } else if (state.running) {
            builder.setContentText(phase)
                .setUsesChronometer(true)
                .setWhen(now - state.elapsedMs(now))
                .setShowWhen(true)
        } else {
            val rest = if (state.mode == Mode.POMODORO) fmtClock(state.remainingMs(now)) else fmtClock(state.elapsedMs(now))
            builder.setContentText("$phase · pausado em $rest").setShowWhen(false)
        }
        app.decorateTimerNotification(builder, state, now)
        return builder.build()
    }

    companion object {
        const val CHANNEL = "timer"
        const val ID = 41
        private const val ACTION_STOP = "br.app.coado.timer.STOP"

        /** Mostra (ou atualiza) a notificação da sessão corrente */
        fun update(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, TimerService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TimerService::class.java))
        }
    }
}
