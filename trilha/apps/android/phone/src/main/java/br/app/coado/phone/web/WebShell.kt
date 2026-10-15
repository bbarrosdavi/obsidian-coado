package br.app.coado.phone.web

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri

/** O site do Coado, com a sessão da conta, numa WebView */
class WebShell(
    context: Context,
    private val server: String,
    private val bridge: NativeBridge,
    private val onFileChooser: (ValueCallback<Array<Uri>>, WebChromeClient.FileChooserParams) -> Boolean,
    /** a troca Bearer → cookie foi recusada (token morto) */
    private val onSessionRefused: () -> Unit,
) {
    @SuppressLint("SetJavaScriptEnabled")
    val view: WebView = WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportZoom(false)
        settings.userAgentString = settings.userAgentString + " CoadoApp"
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        addJavascriptInterface(bridge, NativeBridge.NAME)
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                // o site fica aqui; qualquer outro endereço (links de tópicos, Google) vai ao navegador
                if (url.toString().startsWith(origin)) return false
                runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return true
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && request.url.path == "/api/auth/web-session" && errorResponse.statusCode == 401) onSessionRefused()
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(webView: WebView, filePathCallback: ValueCallback<Array<Uri>>, fileChooserParams: FileChooserParams): Boolean =
                onFileChooser(filePathCallback, fileChooserParams)
        }
        // a gaveta de arquivos: baixar leva o cookie da sessão
        setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(url.toUri())
                .setMimeType(mimeType)
                .addRequestHeader("cookie", CookieManager.getInstance().getCookie(url))
                .addRequestHeader("User-Agent", userAgent)
                .setTitle(name)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            runCatching { (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request) }
        }
    }

    private val origin get() = server.trimEnd('/')

    /**
     * Entra: a api troca o Bearer por uma sessão web (cookie) e redireciona para o app.
     * A WebView manda o cabeçalho só nesta carga; dali em diante vale o cookie.
     */
    fun signIn(token: String, returnTo: String = "/") {
        view.loadUrl("$origin/api/auth/web-session?returnTo=${Uri.encode(returnTo)}", mapOf("Authorization" to "Bearer $token"))
    }

    fun reload() = view.reload()

    /** O site recarrega os dados da conta ao voltar à frente (visibilitychange) */
    fun refreshData() {
        view.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange'))", null)
    }

    fun canGoBack() = view.canGoBack()
    fun goBack() = view.goBack()

    fun clearSession() {
        CookieManager.getInstance().removeAllCookies(null)
        view.clearHistory()
        view.loadUrl("about:blank")
    }
}

@Composable
fun WebShellView(shell: WebShell, modifier: Modifier = Modifier) {
    AndroidView(factory = { shell.view }, modifier = modifier.fillMaxSize())
}
