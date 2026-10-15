package br.app.coado.watch

import android.Manifest
import android.app.RemoteInput
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.lifecycleScope
import androidx.wear.ambient.AmbientLifecycleObserver
import androidx.wear.input.RemoteInputIntentHelper
import br.app.coado.shared.data.ApiException
import br.app.coado.shared.model.Transport
import br.app.coado.watch.ui.Ambient
import br.app.coado.watch.ui.CoadoWatchRoot
import br.app.coado.watch.ui.InputField
import kotlinx.coroutines.launch

/**
 * O app no pulso. Tudo que é texto (código de pareamento, servidor) entra pelo teclado do
 * sistema ou pelo adb, para não digitar no relógio:
 *   adb shell am start -n br.app.coado/br.app.coado.watch.MainActivity --es servidor http://10.0.2.2:5173 --es codigo 123456
 */
class MainActivity : ComponentActivity() {
    private val app get() = application as CoadoWatchApp
    private var field = InputField.CODE

    /** modo ambiente: o pulso abaixou e a tela ficou no mínimo (uma atualização por minuto) */
    val ambient = mutableStateOf(Ambient())
    private val ambientTick = mutableIntStateOf(0)

    /** mensagem curta para a tela de ajustes (resultado do pareamento) */
    val notice = mutableStateOf("")

    private val keyboard = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val data = r.data ?: return@registerForActivityResult
        val text = RemoteInput.getResultsFromIntent(data)?.getCharSequence(KEY)?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return@registerForActivityResult
        when (field) {
            InputField.CODE -> pair(text.filter { it.isDigit() })
            InputField.SERVER -> lifecycleScope.launch { app.store.updatePrefs { it.copy(server = text) } }
        }
    }

    private val notifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    private val ambientObserver = AmbientLifecycleObserver(this, object : AmbientLifecycleObserver.AmbientLifecycleCallback {
        override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
            ambient.value = Ambient(on = true, lowBit = ambientDetails.deviceHasLowBitAmbient, burnIn = ambientDetails.burnInProtectionRequired, tick = ambientTick.intValue)
        }

        override fun onUpdateAmbient() {
            ambientTick.intValue++
            ambient.value = ambient.value.copy(tick = ambientTick.intValue)
        }

        override fun onExitAmbient() {
            ambient.value = Ambient()
        }
    })

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycle.addObserver(ambientObserver)
        provision(intent)
        setContent {
            CoadoWatchRoot(
                app = app,
                ambient = ambient.value,
                notice = notice.value,
                edit = ::edit,
                ensureNotifications = ::ensureNotifications,
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        provision(intent)
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            app.store.awaitLoaded()
            val prefs = app.store.prefs.value
            val snap = app.store.snapshot.value
            val stale = snap == null || System.currentTimeMillis() - snap.fetchedAt > 15 * 60_000
            if (stale || !app.store.pending.value.isEmpty) app.sync.syncNow()
            if (prefs.transport == Transport.DIRECT && !prefs.signedIn) return@launch
        }
    }

    private fun provision(i: Intent?) {
        i?.getStringExtra("servidor")?.let { s -> lifecycleScope.launch { app.store.updatePrefs { it.copy(server = s) } } }
        i?.getStringExtra("codigo")?.let { pair(it) }
    }

    /** A notificação da sessão só aparece com a permissão (Android 13+) */
    private fun ensureNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** O teclado do relógio (ou o ditado, ou o do celular pareado) para um campo de texto */
    private fun edit(f: InputField) {
        field = f
        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        val input = RemoteInput.Builder(KEY).setLabel(f.label).build()
        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(input))
        keyboard.launch(intent)
    }

    /** Conexão direta: troca o código de Configurações → Relógio pelo token de aparelho */
    private fun pair(code: String) {
        lifecycleScope.launch {
            notice.value = "Pareando…"
            try {
                app.store.awaitLoaded()
                val res = app.api.pair(app.server, code, app.deviceName)
                app.store.updatePrefs { it.copy(token = res.token, accountName = res.me.name, accountEmail = res.me.email, transport = Transport.DIRECT) }
                notice.value = "Pareado como ${res.me.name}"
                app.sync.syncNow()
            } catch (e: ApiException) {
                Log.w(TAG, "pareamento recusado: ${e.status} ${e.code} ${e.message}")
                notice.value = e.message ?: "Não deu para parear."
            } catch (e: Exception) {
                Log.w(TAG, "pareamento falhou", e)
                notice.value = "Não deu para parear: ${e.message}"
            }
        }
    }

    private companion object {
        const val KEY = "texto"
        const val TAG = "CoadoWatch"
    }
}
