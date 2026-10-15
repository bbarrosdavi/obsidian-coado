package br.app.coado.phone.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.Fraunces
import br.app.coado.shared.ui.Nunito

/** O tema do site no celular: a paleta escolhida, clara de dia e noturna à noite. Funções, não vals: acompanham a troca de paleta */
private fun dark() = darkColorScheme(
    primary = Cores.Brand300,
    onPrimary = Cores.Bg,
    primaryContainer = Cores.Brand700,
    onPrimaryContainer = Cores.Brand100,
    secondary = Cores.Ok,
    onSecondary = Cores.Bg,
    tertiary = Cores.Warn,
    background = Cores.Bg,
    onBackground = Cores.Ink,
    surface = Cores.Surface,
    onSurface = Cores.Ink,
    surfaceVariant = Cores.Surface2,
    onSurfaceVariant = Cores.Muted,
    surfaceContainer = Cores.Surface2,
    surfaceContainerHigh = Cores.Line,
    outline = Cores.Line,
    outlineVariant = Cores.Kraft,
    error = Cores.Bad,
    onError = Cores.Bg,
)

private fun light() = lightColorScheme(
    primary = Cores.Brand600,
    onPrimary = Cores.Brand50,
    primaryContainer = Cores.Brand100,
    onPrimaryContainer = Cores.Brand800,
    secondary = Cores.Light.Ok,
    onSecondary = Cores.Brand50,
    tertiary = Cores.Light.Warn,
    background = Cores.Light.Bg,
    onBackground = Cores.Light.Ink,
    surface = Cores.Light.Surface,
    onSurface = Cores.Light.Ink,
    surfaceVariant = Cores.Light.Surface2,
    onSurfaceVariant = Cores.Light.Muted,
    surfaceContainer = Cores.Light.Surface2,
    surfaceContainerHigh = Cores.Light.Line,
    outline = Cores.Light.Line,
    outlineVariant = Cores.Light.Line,
    error = Cores.Light.Bad,
    onError = Cores.Brand50,
)

private val PhoneTypography = Typography(
    displayLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 64.sp, letterSpacing = (-1.5).sp, fontFeatureSettings = "tnum"),
    headlineMedium = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.Bold, fontSize = 26.sp),
    headlineSmall = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 22.sp),
    titleLarge = TextStyle(fontFamily = Fraunces, fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 16.sp),
    titleSmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 14.sp),
    bodyLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Medium, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Medium, fontSize = 14.sp),
    bodySmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelLarge = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 12.sp, letterSpacing = 0.8.sp),
    labelSmall = TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.sp),
)

@Composable
fun PhoneTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (dark) dark() else light(), typography = PhoneTypography, content = content)
}
