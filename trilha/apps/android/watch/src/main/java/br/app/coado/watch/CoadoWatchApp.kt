package br.app.coado.watch

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.data.DirectTransport
import br.app.coado.shared.data.Transport
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.Transport as TransportKind
import br.app.coado.shared.timer.TimerService
import br.app.coado.shared.timer.TimerState
import br.app.coado.shared.timer.label
import br.app.coado.shared.R as SharedR

/**
 * O Coado no pulso. A conta chega pelo celular (Data Layer) ou, sem ele, direto na api com o
 * código de Configurações → Relógio. A sessão em andamento vira uma atividade em andamento do
 * Wear OS: o mostrador mostra o tempo restante sem o app rodar.
 */
class CoadoWatchApp : CoadoCore() {
    override val userAgent get() = "Coado Watch/${BuildConfig.VERSION_NAME} ($deviceName)"
    override val deviceName: String get() = Build.MODEL.ifBlank { "Relógio" }

    val phone by lazy { PhoneTransport(this) }

    override fun transport(): Transport? {
        val prefs = store.prefs.value
        return when (prefs.transport) {
            TransportKind.PHONE -> phone
            TransportKind.DIRECT -> if (prefs.signedIn) DirectTransport(server, prefs.token, api) else null
        }
    }

    override fun timerIntent(): Intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    override fun decorateTimerNotification(builder: NotificationCompat.Builder, state: TimerState, now: Long) {
        val open = PendingIntent.getActivity(this, 0, timerIntent(), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val phase = if (state.mode == Mode.FREE) "Livre" else state.phase.label
        // o sistema conta o tempo no chip do mostrador: nada acorda o app
        val time: Status.Part = when {
            state.mode == Mode.POMODORO && state.running -> Status.TimerPart(state.phaseEndAt ?: now)
            state.mode == Mode.POMODORO -> Status.TimerPart(now + state.remainingMs(now), now)
            state.running -> Status.StopwatchPart(now - state.elapsedMs(now))
            else -> Status.StopwatchPart(now - state.elapsedMs(now), now)
        }
        val status = Status.Builder()
            .addTemplate("#phase# #time#")
            .addPart("phase", Status.TextPart(phase))
            .addPart("time", time)
            .build()
        OngoingActivity.Builder(applicationContext, TimerService.ID, builder)
            .setStaticIcon(SharedR.drawable.ic_trail)
            .setTouchIntent(open)
            .setStatus(status)
            .build()
            .apply(applicationContext)
    }
}
