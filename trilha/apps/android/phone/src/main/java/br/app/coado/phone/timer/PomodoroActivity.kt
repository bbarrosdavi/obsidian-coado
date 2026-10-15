package br.app.coado.phone.timer

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import br.app.coado.phone.CoadoPhoneApp
import br.app.coado.phone.ui.PhoneTheme
import br.app.coado.shared.model.Dates
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.json
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/** O que o site manda ao abrir o cronômetro (TimerRequest) */
@Serializable
data class TimerRequest(val subjectId: String? = null, val topicId: String? = null, val categoryId: String? = null)

/**
 * O pomodoro nativo do celular, sempre no modo noturno como a tela do site. Abre pelo site
 * (botão de iniciar estudo), pela notificação da sessão ou pelo atalho; ao registrar, o estudo
 * sobe para a conta e vai para o relógio.
 */
class PomodoroActivity : ComponentActivity() {
    private val app get() = application as CoadoPhoneApp
    private val request = mutableStateOf(TimerRequest())
    private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    /** A notificação da sessão só aparece com a permissão (Android 13+): pedimos ao começar */
    private fun ensureNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handle(intent)
        setContent {
            PhoneTheme(dark = true) {
                val snapshot by app.store.snapshot.collectAsStateWithLifecycle()
                val pending by app.store.pending.collectAsStateWithLifecycle()
                val prefs by app.store.prefs.collectAsStateWithLifecycle()
                val timer by app.store.timer.collectAsStateWithLifecycle()
                val draft by app.store.draft.collectAsStateWithLifecycle()
                val view = remember(snapshot, pending) { Overview(snapshot, pending, Dates.today()) }
                PomodoroFlow(
                    app = app,
                    view = view,
                    prefs = prefs,
                    timer = timer,
                    draft = draft,
                    request = request.value,
                    ensureNotifications = ::ensureNotifications,
                    onClose = { finish() },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        // o plano, o ciclo e as durações podem ter mudado no site há pouco: um recorte novo antes de escolher
        lifecycleScope.launch {
            app.store.awaitLoaded()
            if (app.store.prefs.value.signedIn && !app.store.timer.value.active) app.sync.syncNow()
        }
    }

    private fun handle(i: Intent?) {
        i?.getStringExtra(EXTRA_REQUEST)?.let { raw ->
            request.value = runCatching { json.decodeFromString<TimerRequest>(raw) }.getOrDefault(TimerRequest())
        }
        if (i?.getBooleanExtra(EXTRA_FINISH, false) == true) {
            i.removeExtra(EXTRA_FINISH)
            lifecycleScope.launch { app.engine.finish() }
        }
    }

    companion object {
        const val EXTRA_REQUEST = "request"
        const val EXTRA_FINISH = "finish"
        val Overlay = Color(0xFF1B1410)
    }
}
