package br.app.coado.phone

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import br.app.coado.phone.timer.PomodoroActivity
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.R
import br.app.coado.shared.data.DirectTransport
import br.app.coado.shared.data.Transport
import br.app.coado.shared.data.Wear
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.Review
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.model.Study
import br.app.coado.shared.model.TimerPrefs
import br.app.coado.shared.model.json
import br.app.coado.shared.timer.TimerReceiver
import br.app.coado.shared.timer.TimerState
import br.app.coado.shared.ui.Cores
import androidx.compose.ui.graphics.toArgb
import kotlinx.serialization.encodeToString

/**
 * O Coado no celular: o site inteiro numa WebView com a sessão da conta, o pomodoro nativo e a
 * ponte com o relógio. A conta é a sessão de aparelho (Bearer) aberta pelo Sign in with Google.
 */
class CoadoPhoneApp : CoadoCore() {
    override val userAgent get() = "Coado Android/${BuildConfig.VERSION_NAME} ($deviceName)"
    override val deviceName: String get() = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android" }

    override fun transport(): Transport? {
        val prefs = store.prefs.value
        return if (prefs.signedIn) DirectTransport(server, prefs.token, api) else null
    }

    override fun timerIntent(): Intent = Intent(this, PomodoroActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    override fun decorateTimerNotification(builder: NotificationCompat.Builder, state: TimerState, now: Long) {
        builder.setColor(Cores.Brand600.toArgb())
        builder.addAction(
            if (state.running) R.drawable.ic_pause else R.drawable.ic_play,
            getString(if (state.running) R.string.timer_pause else R.string.timer_resume),
            TimerReceiver.pending(this, TimerReceiver.ACTION_TOGGLE),
        )
        if (state.mode == Mode.POMODORO) {
            builder.addAction(R.drawable.ic_skip, getString(R.string.timer_skip), TimerReceiver.pending(this, TimerReceiver.ACTION_SKIP))
        }
        val finish = PendingIntent.getActivity(
            this,
            1,
            timerIntent().putExtra(PomodoroActivity.EXTRA_FINISH, true),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        builder.addAction(R.drawable.ic_stop, getString(R.string.timer_finish), finish)
    }

    /** O que o relógio deixou no Data Layer entra na fila deste aparelho */
    override suspend fun beforeSync() {
        absorbWatchItems()
    }

    /** Sobe o que havia, apaga os itens já subidos e publica o recorte novo para o relógio */
    override suspend fun afterSync(snapshot: Snapshot) {
        runCatching {
            Wear.delete(this, Wear.STUDY)
            Wear.delete(this, Wear.REVIEW)
            Wear.delete(this, Wear.SETTINGS)
            publish(snapshot)
        }.onFailure { Log.d(TAG, "sem relógio por perto para publicar: ${it.message}") }
    }

    suspend fun publish(snapshot: Snapshot) {
        // um item de dados tem 100 KB: um ciclo longo cabe, mas sem exagero
        var snap = snapshot
        var payload = json.encodeToString(snap)
        if (payload.length > 90_000) {
            snap = snap.copy(studies = snap.studies.takeLast(300), studiedDates = snap.studiedDates.takeLast(400))
            payload = json.encodeToString(snap)
        }
        Wear.put(this, Wear.SNAPSHOT, payload)
    }

    /** Estudos, revisões e durações vindos do relógio viram pendências deste aparelho (uma vez cada) */
    suspend fun absorbWatchItems(): Boolean {
        var changed = false
        runCatching {
            val have = store.pending.value
            val knownStudies = have.studies.map { it.id }.toSet() + store.snapshot.value?.studies.orEmpty().map { it.id }
            val knownReviews = have.reviews.map { it.id }.toSet()
            val studies = Wear.readAll(this, Wear.STUDY).mapNotNull { runCatching { json.decodeFromString<Study>(it) }.getOrNull() }.filter { it.id !in knownStudies }
            val reviews = Wear.readAll(this, Wear.REVIEW).mapNotNull { runCatching { json.decodeFromString<Review>(it) }.getOrNull() }.filter { it.id !in knownReviews }
            if (studies.isNotEmpty() || reviews.isNotEmpty()) {
                store.addPending(studies, reviews)
                changed = true
                Log.i(TAG, "do relógio: ${studies.size} estudos, ${reviews.size} revisões")
            }
            Wear.read(this, Wear.SETTINGS)?.let { raw ->
                val prefs = runCatching { json.decodeFromString<TimerPrefs>(raw) }.getOrNull() ?: return@let
                if (prefs != store.effectivePrefs()) {
                    store.updatePrefs { it.copy(timerPrefs = prefs, prefsDirty = true) }
                    changed = true
                }
            }
        }.onFailure { Log.d(TAG, "sem itens do relógio: ${it.message}") }
        return changed
    }

    companion object {
        const val TAG = "CoadoPhone"
    }
}
