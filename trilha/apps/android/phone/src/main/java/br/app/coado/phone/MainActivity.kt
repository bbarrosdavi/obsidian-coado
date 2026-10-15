package br.app.coado.phone

import br.app.coado.shared.ui.Cores
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import br.app.coado.phone.auth.SignInCancelled
import br.app.coado.phone.auth.signInWithGoogle
import br.app.coado.phone.timer.PomodoroActivity
import br.app.coado.phone.ui.LoginScreen
import br.app.coado.phone.ui.PhoneTheme
import br.app.coado.phone.web.NativeBridge
import br.app.coado.phone.web.WebShell
import br.app.coado.phone.web.WebShellView
import br.app.coado.shared.data.ApiException
import br.app.coado.shared.model.AuthConfig
import br.app.coado.shared.model.PairResponse
import kotlinx.coroutines.launch

/**
 * O app do celular: a tela de entrada nativa (Sign in with Google) e, com a conta, o site inteiro
 * numa WebView que já abre logado. O site sabe que está no app (window.CoadoNative) e manda o
 * botão de iniciar estudo para o pomodoro nativo.
 */
class MainActivity : ComponentActivity() {
    private val app get() = application as CoadoPhoneApp

    private val config = mutableStateOf<AuthConfig?>(null)
    private val configError = mutableStateOf<String?>(null)
    private val busy = mutableStateOf(false)
    private val error = mutableStateOf<String?>(null)

    private var shell: WebShell? = null
    private var shellToken = ""
    private var lastExchangeAt = 0L
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val filePicker = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        fileCallback?.onReceiveValue(uris.toTypedArray())
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        provision(intent)
        setContent {
            PhoneTheme {
                val loaded by app.store.loaded.collectAsStateWithLifecycle()
                val prefs by app.store.prefs.collectAsStateWithLifecycle()
                if (!loaded) return@PhoneTheme
                if (!prefs.signedIn) {
                    shell?.let { it.clearSession(); shell = null }
                    shellToken = ""
                    LoginScreen(
                        config = config.value,
                        configError = configError.value,
                        busy = busy.value,
                        error = error.value,
                        server = app.server,
                        devBuild = BuildConfig.DEBUG,
                        onGoogle = ::googleSignIn,
                        onDev = ::devSignIn,
                        onServer = { s -> lifecycleScope.launch { app.store.updatePrefs { it.copy(server = s) }; loadConfig() } },
                        onRetry = ::loadConfig,
                    )
                } else {
                    val current = shell ?: WebShell(this, app.server, bridge(), ::chooseFile, ::sessionRefused).also { shell = it }
                    if (shellToken != prefs.token) {
                        shellToken = prefs.token
                        current.signIn(prefs.token)
                        lastExchangeAt = System.currentTimeMillis()
                    }
                    Site(current)
                }
            }
        }
        loadConfig()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        provision(intent)
    }

    /** O servidor também entra pelo adb, para não digitar no aparelho:
     *  adb shell am start -n br.app.coado/br.app.coado.phone.MainActivity --es servidor http://127.0.0.1:5173 */
    private fun provision(i: Intent?) {
        val server = i?.getStringExtra("servidor") ?: return
        lifecycleScope.launch {
            app.store.updatePrefs { it.copy(server = server) }
            loadConfig()
        }
    }

    @Composable
    private fun Site(current: WebShell) {
        BackHandler(enabled = true) { if (current.canGoBack()) current.goBack() else moveTaskToBack(true) }
        WebShellView(current, Modifier.fillMaxSize().systemBarsPadding())
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            app.store.awaitLoaded()
            if (!app.store.prefs.value.signedIn) return@launch
            // o que o relógio registrou e o que ficou pendente sobem; o recorte vai para o relógio
            if (app.absorbWatchItems() || !app.store.pending.value.isEmpty) app.sync.syncNow()
            else {
                val snap = app.store.snapshot.value
                if (snap == null || System.currentTimeMillis() - snap.fetchedAt > 15 * 60_000) app.sync.syncNow()
            }
            shell?.refreshData()
        }
    }

    private fun bridge() = NativeBridge(
        onOpenTimer = { json ->
            startActivity(Intent(this, PomodoroActivity::class.java).putExtra(PomodoroActivity.EXTRA_REQUEST, json))
        },
        onAuthChanged = { status ->
            // a sessão web venceu ou foi encerrada no perfil: renova com o Bearer (uma vez por minuto)
            if (status == "anonymous" && System.currentTimeMillis() - lastExchangeAt > 60_000) {
                val token = app.store.prefs.value.token
                if (token.isNotEmpty()) {
                    lastExchangeAt = System.currentTimeMillis()
                    shell?.signIn(token)
                }
            }
        },
        onSignIn = { googleSignIn() },
        onPalette = { id -> Cores.escolher(this, id) },
    )

    private fun chooseFile(callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        fileCallback?.onReceiveValue(null)
        fileCallback = callback
        filePicker.launch(params.acceptTypes.firstOrNull()?.takeIf { it.isNotBlank() } ?: "*/*")
        return true
    }

    /** O Bearer morreu (sessão encerrada no perfil, conta apagada): volta ao login */
    private fun sessionRefused() {
        lifecycleScope.launch { app.store.signOut() }
    }

    private fun loadConfig() {
        lifecycleScope.launch {
            configError.value = null
            config.value = null
            try {
                app.store.awaitLoaded()
                config.value = app.api.authConfig(app.server)
            } catch (e: ApiException) {
                configError.value = if (e.offline) "Sem conexão com ${app.server}." else e.message
            } catch (e: Exception) {
                configError.value = e.message
            }
        }
    }

    private fun googleSignIn() {
        val clientId = config.value?.googleClientId ?: return
        lifecycleScope.launch {
            busy.value = true
            error.value = null
            try {
                val idToken = signInWithGoogle(this@MainActivity, clientId)
                signedIn(app.api.googleToken(app.server, idToken, app.deviceName))
            } catch (e: SignInCancelled) {
                // nada a dizer
            } catch (e: Exception) {
                error.value = e.message ?: "Não deu para entrar."
            } finally {
                busy.value = false
            }
        }
    }

    private fun devSignIn(name: String) {
        lifecycleScope.launch {
            busy.value = true
            error.value = null
            try {
                signedIn(app.api.devToken(app.server, name, "dev@coado.local", app.deviceName))
            } catch (e: Exception) {
                error.value = e.message ?: "Não deu para entrar."
            } finally {
                busy.value = false
            }
        }
    }

    private suspend fun signedIn(res: PairResponse) {
        app.store.updatePrefs { it.copy(token = res.token, accountName = res.me.name, accountEmail = res.me.email) }
        app.sync.syncNow()
    }
}
