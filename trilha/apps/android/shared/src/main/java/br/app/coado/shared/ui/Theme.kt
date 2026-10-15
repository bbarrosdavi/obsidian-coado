package br.app.coado.shared.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import br.app.coado.shared.R

/** Os tons de um modo (claro ou noturno) de uma paleta: os mesmos tokens do site (apps/web/src/index.css) */
data class Tons(
    val bg: Color, val surface: Color, val surface2: Color, val line: Color, val ink: Color,
    val muted: Color, val kraft: Color, val ok: Color, val bad: Color, val warn: Color,
)

/** Uma paleta do site: a escala da marca (50 a 900) e os tons claro e noturno */
data class Paleta(val id: String, val nome: String, val marca: List<Color>, val claro: Tons, val escuro: Tons)

private fun c(hex: Long) = Color(0xFF000000L or hex)
private fun escala(vararg h: Long) = h.map(::c)
private fun tons(bg: Long, surface: Long, surface2: Long, line: Long, ink: Long, muted: Long, kraft: Long, ok: Long, bad: Long, warn: Long) =
    Tons(c(bg), c(surface), c(surface2), c(line), c(ink), c(muted), c(kraft), c(ok), c(bad), c(warn))

/** As paletas do site, com os mesmos ids (o "cafe" é o Âmbar, id antigo mantido para não perder a escolha salva) */
val PALETAS = listOf(
    Paleta(
        "cafe", "Âmbar",
        escala(0xf9f1e7, 0xf1e1cf, 0xe4c7a8, 0xd3a97f, 0xc08f5d, 0xad7a4a, 0x96663b, 0x7a512f, 0x5c3d24, 0x432c1b),
        tons(0xf4ece1, 0xfffaf2, 0xf1e5d5, 0xe3d3bf, 0x3a2a1f, 0x8c7563, 0xecd9bd, 0x6f9a73, 0xc96f6b, 0xd9a441),
        tons(0x1b1410, 0x251c16, 0x30251d, 0x3e3026, 0xf1e6d7, 0xb59e8a, 0x3b2d22, 0x8fb892, 0xd98783, 0xe2b55e),
    ),
    Paleta(
        "grafite", "Grafite",
        escala(0xf4f6f8, 0xe6eaef, 0xcbd3dc, 0xa5b2c1, 0x7a8ba0, 0x5b6d83, 0x48586c, 0x3a4757, 0x2c3643, 0x1f2630),
        tons(0xf3f4f6, 0xffffff, 0xeceef1, 0xdde1e6, 0x1f2630, 0x67717e, 0xe3e7ec, 0x4f9a6e, 0xc8605c, 0xc99a3a),
        tons(0x121418, 0x1a1d22, 0x23272e, 0x323842, 0xe6e9ee, 0x9aa3ae, 0x262b33, 0x7fbf98, 0xe08884, 0xe2b55e),
    ),
    Paleta(
        "oceano", "Oceano",
        escala(0xeef7fb, 0xd5ecf5, 0xaad8ea, 0x75bedb, 0x45a0c6, 0x2a84ad, 0x1f6b90, 0x1b5675, 0x18455d, 0x133548),
        tons(0xeef4f7, 0xfbfdfe, 0xe3edf2, 0xcfdfe7, 0x10303f, 0x5d7683, 0xdbe9f0, 0x3f9a7a, 0xcc6b67, 0xd6a13f),
        tons(0x0d171d, 0x132129, 0x1a2c36, 0x26404d, 0xe4eff4, 0x92abb7, 0x1c3340, 0x78c4a6, 0xe38f8b, 0xe6bb62),
    ),
    Paleta(
        "floresta", "Floresta",
        escala(0xf1f7f1, 0xdcecdc, 0xb9d8ba, 0x8dbd90, 0x639f68, 0x47844d, 0x376a3d, 0x2d5532, 0x24432a, 0x1c3421),
        tons(0xf1f4ee, 0xfcfdfa, 0xe7ece2, 0xd4dccd, 0x1d2b1f, 0x66735f, 0xe2e9d9, 0x4f9a5c, 0xc46a5f, 0xc99b3b),
        tons(0x10150f, 0x171e16, 0x1f281e, 0x2e3a2c, 0xe6ece2, 0x9eab97, 0x222c20, 0x8cc394, 0xdd8c84, 0xe0b862),
    ),
    Paleta(
        "ameixa", "Ameixa",
        escala(0xf6f2fb, 0xebe2f6, 0xd6c4ed, 0xb99de0, 0x9a76cf, 0x7f58b8, 0x68459a, 0x55387d, 0x432d62, 0x33234a),
        tons(0xf4f1f7, 0xfdfcfe, 0xebe6f1, 0xdcd4e6, 0x261d33, 0x6f6580, 0xe7dff0, 0x4f9a76, 0xc9637a, 0xcf9f43),
        tons(0x141019, 0x1c1623, 0x251e2e, 0x362c43, 0xece6f3, 0xa69bb5, 0x2a2135, 0x85c3a5, 0xe58ea2, 0xe5bc68),
    ),
    Paleta(
        "magenta", "Magenta",
        escala(0xfdf0f6, 0xfbdcea, 0xf6b6d3, 0xee84b5, 0xe25396, 0xcf2f7c, 0xb01f66, 0x8f1953, 0x6f1542, 0x521033),
        tons(0xf8f1f4, 0xfffbfd, 0xf0e5ea, 0xe5d3dc, 0x2e1a24, 0x806673, 0xf2e1e9, 0x4f9a76, 0xc9534f, 0xcf9f43),
        tons(0x170f13, 0x20151b, 0x2a1c23, 0x3d2a33, 0xf2e6ec, 0xb39aa7, 0x2e1d26, 0x85c3a5, 0xe58c88, 0xe5bc68),
    ),
)

/**
 * As cores em uso: as do modo noturno da paleta escolhida (o fundo quase preto do AMOLED), e as do
 * modo claro em [Light]. A escolha é por aparelho, como no site: cada um guarda a sua.
 * Ler uma cor durante a composição a inscreve na troca de paleta: trocar redesenha tudo.
 */
object Cores {
    private const val PREFS = "aparencia"
    private const val CHAVE = "paleta"

    var paleta by mutableStateOf(PALETAS[0])
        private set

    fun carregar(context: Context) {
        val id = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CHAVE, null)
        paleta = PALETAS.firstOrNull { it.id == id } ?: PALETAS[0]
    }

    fun escolher(context: Context, id: String) {
        val p = PALETAS.firstOrNull { it.id == id } ?: return
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CHAVE, p.id).apply()
        paleta = p
    }

    val Bg get() = paleta.escuro.bg
    val Surface get() = paleta.escuro.surface
    val Surface2 get() = paleta.escuro.surface2
    val Line get() = paleta.escuro.line
    val Ink get() = paleta.escuro.ink
    val Muted get() = paleta.escuro.muted
    val Kraft get() = paleta.escuro.kraft
    val Ok get() = paleta.escuro.ok
    val Bad get() = paleta.escuro.bad
    val Warn get() = paleta.escuro.warn

    val Brand50 get() = paleta.marca[0]
    val Brand100 get() = paleta.marca[1]
    val Brand200 get() = paleta.marca[2]
    val Brand300 get() = paleta.marca[3]
    val Brand400 get() = paleta.marca[4]
    val Brand500 get() = paleta.marca[5]
    val Brand600 get() = paleta.marca[6]
    val Brand700 get() = paleta.marca[7]
    val Brand800 get() = paleta.marca[8]
    val Brand900 get() = paleta.marca[9]

    /** o modo claro da paleta (o celular de dia) */
    object Light {
        val Bg get() = paleta.claro.bg
        val Surface get() = paleta.claro.surface
        val Surface2 get() = paleta.claro.surface2
        val Line get() = paleta.claro.line
        val Ink get() = paleta.claro.ink
        val Muted get() = paleta.claro.muted
        val Ok get() = paleta.claro.ok
        val Bad get() = paleta.claro.bad
        val Warn get() = paleta.claro.warn
    }
}

/** "#c08f5d" → Color; qualquer coisa estranha vira a cor da marca */
fun parseColor(hex: String): Color {
    val h = hex.trim().removePrefix("#")
    return runCatching {
        when (h.length) {
            6 -> Color(0xFF000000L or h.toLong(16))
            8 -> Color(h.toLong(16))
            3 -> Color(0xFF000000L or h.map { "$it$it" }.joinToString("").toLong(16))
            else -> Cores.Brand400
        }
    }.getOrDefault(Cores.Brand400)
}

/** Nunito, a fonte de texto do site (variável: um arquivo, todos os pesos) */
val Nunito = FontFamily(
    Font(R.font.nunito, FontWeight.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400))),
    Font(R.font.nunito, FontWeight.Medium, variationSettings = FontVariation.Settings(FontVariation.weight(500))),
    Font(R.font.nunito, FontWeight.SemiBold, variationSettings = FontVariation.Settings(FontVariation.weight(600))),
    Font(R.font.nunito, FontWeight.Bold, variationSettings = FontVariation.Settings(FontVariation.weight(700))),
    Font(R.font.nunito, FontWeight.ExtraBold, variationSettings = FontVariation.Settings(FontVariation.weight(800))),
)

private fun fraunces(weight: Int, w: FontWeight) = Font(
    R.font.fraunces,
    w,
    // os mesmos eixos do site: SOFT 100, WONK 1
    variationSettings = FontVariation.Settings(
        FontVariation.weight(weight),
        FontVariation.Setting("SOFT", 100f),
        FontVariation.Setting("WONK", 1f),
        FontVariation.Setting("opsz", 72f),
    ),
)

/** Fraunces, a fonte de título do site */
val Fraunces = FontFamily(
    fraunces(500, FontWeight.Medium),
    fraunces(600, FontWeight.SemiBold),
    fraunces(700, FontWeight.Bold),
)

/** Os estilos de texto comuns; cada app ajusta o tamanho à tela */
object Tipo {
    /** o relógio da sessão */
    val display = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 44.sp, letterSpacing = (-1).sp, fontFeatureSettings = "tnum")
    val numeral = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 24.sp, fontFeatureSettings = "tnum")
    val title = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    val subtitle = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    val body = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Medium, fontSize = 13.sp)
    val bodySmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Medium, fontSize = 11.sp)
    /** o "label" do site: caixa alta, espaçado */
    val label = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 10.sp, letterSpacing = 1.2.sp)
    val button = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 13.sp)
}
