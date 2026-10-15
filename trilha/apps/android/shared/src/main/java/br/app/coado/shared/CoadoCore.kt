package br.app.coado.shared

import br.app.coado.shared.ui.Cores
import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import br.app.coado.shared.data.Api
import br.app.coado.shared.data.Store
import br.app.coado.shared.data.SyncManager
import br.app.coado.shared.data.Transport
import br.app.coado.shared.model.Snapshot
import br.app.coado.shared.timer.TimerEngine
import br.app.coado.shared.timer.TimerState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * O que o celular e o relógio têm em comum: o estado guardado, o motor do pomodoro e a
 * sincronização. Cada app diz como chega à conta ([transport]) e o que abre ao tocar na
 * notificação da sessão ([timerIntent]).
 */
abstract class CoadoCore : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var store: Store
        private set
    lateinit var api: Api
        private set
    lateinit var engine: TimerEngine
        private set
    lateinit var sync: SyncManager
        private set

    /** "Coado Android/0.1 (Pixel 9)" */
    abstract val userAgent: String

    /** nome do aparelho para a lista de sessões do perfil */
    open val deviceName: String get() = Build.MODEL.ifBlank { "Android" }

    /** origem do servidor em uso (sem /api) */
    val server: String get() = store.prefs.value.server.ifBlank { BuildConfig.DEFAULT_SERVER }

    /** como este aparelho chega à conta; null sem conta */
    abstract fun transport(): Transport?

    /** a tela do pomodoro, para a notificação da sessão */
    abstract fun timerIntent(): Intent

    /** o relógio prende a atividade em andamento à notificação; o celular põe os botões */
    open fun decorateTimerNotification(builder: NotificationCompat.Builder, state: TimerState, now: Long) {}

    /** antes de subir: o celular recolhe o que o relógio deixou no Data Layer */
    open suspend fun beforeSync() {}

    /** depois de uma sincronização boa: o celular republica o recorte para o relógio */
    open suspend fun afterSync(snapshot: Snapshot) {}

    /** a api recusou o token: a conta saiu deste aparelho */
    open suspend fun onUnauthorized() {
        store.signOut()
    }

    override fun onCreate() {
        super.onCreate()
        Cores.carregar(this)                                  // a paleta escolhida neste aparelho
        store = Store(this)
        api = Api(userAgent)
        engine = TimerEngine(this)
        sync = SyncManager(this)
        scope.launch {
            store.load()
            engine.restore()
        }
    }

    companion object {
        fun of(context: Context) = context.applicationContext as CoadoCore
    }
}
