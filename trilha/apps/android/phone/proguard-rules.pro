# a ponte com o site: os métodos chamados pelo JavaScript da WebView
-keepclassmembers class br.app.coado.phone.web.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
# as regras do kotlinx.serialization vêm do :shared (consumer-rules.pro)
