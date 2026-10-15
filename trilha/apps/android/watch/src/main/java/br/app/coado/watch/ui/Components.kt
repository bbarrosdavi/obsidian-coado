package br.app.coado.watch.ui

import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnItemScope
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnScope
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnState
import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.lazy.TransformationSpec
import androidx.wear.compose.material3.lazy.rememberTransformationSpec
import androidx.wear.compose.material3.lazy.transformedHeight
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.Tipo

/*
 * As peças das telas do relógio: linhas em pílula (como os botões do Wear, que acompanham a
 * tela redonda), nas cores da paleta escolhida.
 */

val PillShape = RoundedCornerShape(24.dp)
val SmallShape = RoundedCornerShape(12.dp)

/** Lista que rola em roda, com o indicador de rolagem e os vãos da tela redonda */
class WheelScope internal constructor(private val list: TransformingLazyColumnScope, private val spec: TransformationSpec) {
    fun item(key: Any? = null, content: @Composable () -> Unit) {
        list.item(key) { Wheel(this, spec, content) }
    }

    fun <T> items(items: List<T>, key: ((T) -> Any)? = null, content: @Composable (T) -> Unit) {
        items.forEach { item(key?.invoke(it)) { content(it) } }
    }

    /** título de seção, como o "label" do site */
    fun section(text: String) = item {
        Text(
            text.uppercase(),
            style = Tipo.label,
            color = Cores.Muted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
        )
    }

    fun note(text: String, color: Color = Cores.Muted) = item {
        Text(text, style = Tipo.bodySmall, color = color, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp))
    }

    fun gap(height: Dp = 6.dp) = item { Spacer(Modifier.height(height)) }
}

@Composable
private fun Wheel(scope: TransformingLazyColumnItemScope, spec: TransformationSpec, content: @Composable () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxWidth()
            .transformedHeight(scope, spec)
            .graphicsLayer { with(scope) { with(spec) { applyContainerTransformation(scrollProgress) } } },
    ) { content() }
}

@Composable
fun WheelScreen(
    state: TransformingLazyColumnState = rememberTransformingLazyColumnState(),
    horizontal: Dp = Dp.Unspecified,
    content: WheelScope.() -> Unit,
) {
    val spec = rememberTransformationSpec()
    val config = LocalConfiguration.current
    // tela redonda: a margem cresce com a tela, para o que encosta na borda não cair fora do círculo
    val horizontal = if (horizontal != Dp.Unspecified) horizontal else if (config.isScreenRound) (config.screenWidthDp * 0.06f).dp else 8.dp
    ScreenScaffold(scrollState = state) { padding ->
        TransformingLazyColumn(
            state = state,
            contentPadding = PaddingValues(
                start = horizontal,
                end = horizontal,
                top = padding.calculateTopPadding(),
                bottom = padding.calculateBottomPadding(),
            ),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxSize().background(Cores.Bg),
        ) { WheelScope(this, spec).content() }
    }
}

/** Uma linha em pílula: ícone ou cor à esquerda, título e subtítulo, e o que vier à direita */
@Composable
fun Pill(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    tint: Color = Cores.Surface,
    titleColor: Color = Cores.Ink,
    enabled: Boolean = true,
    onClick: (() -> Unit)? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (enabled) 1f else 0.45f)
            .clip(PillShape)
            .background(tint)
            .then(if (onClick != null) Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick) else Modifier)
            .heightIn(min = 50.dp)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        leading?.invoke()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, style = Tipo.subtitle, color = titleColor, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = Tipo.bodySmall, color = Cores.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        trailing?.invoke(this)
    }
}

/** Botão cheio, em pílula; o primário é a cor da marca */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: Int? = null,
    primary: Boolean = true,
    color: Color = if (primary) Cores.Brand600 else Cores.Surface2,
    textColor: Color = if (primary) Cores.Brand50 else Cores.Ink,
    enabled: Boolean = true,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        modifier = modifier
            .fillMaxWidth()
            .alpha(if (enabled) 1f else 0.45f)
            .clip(PillShape)
            .background(color)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .heightIn(min = 46.dp)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        if (icon != null) Icon(painterResource(icon), contentDescription = null, tint = textColor, modifier = Modifier.size(16.dp))
        Text(text, style = Tipo.button, color = textColor, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Botão redondo com ícone (os controles do timer) */
@Composable
fun RoundButton(
    icon: Int,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    color: Color = Cores.Surface2,
    tint: Color = Cores.Ink,
    enabled: Boolean = true,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(size)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(CircleShape)
            .background(color)
            .clickable(enabled = enabled, role = Role.Button, onClickLabel = contentDescription, onClick = onClick),
    ) {
        Icon(painterResource(icon), contentDescription = contentDescription, tint = tint, modifier = Modifier.size(size * 0.5f))
    }
}

/** A chave do site: trilho na cor da marca quando ligada */
@Composable
fun Toggle(checked: Boolean, enabled: Boolean = true) {
    Box(
        Modifier
            .size(width = 34.dp, height = 18.dp)
            .clip(CircleShape)
            .background(if (checked && enabled) Cores.Brand500 else Cores.Line),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(Modifier.padding(horizontal = 2.dp).size(14.dp).clip(CircleShape).background(if (checked) Cores.Brand50 else Cores.Muted))
    }
}

@Composable
fun ToggleRow(title: String, checked: Boolean, onToggle: (Boolean) -> Unit, subtitle: String? = null, enabled: Boolean = true) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (enabled) 1f else 0.45f)
            .clip(PillShape)
            .background(Cores.Surface)
            .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onToggle)
            .heightIn(min = 50.dp)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, style = Tipo.subtitle, color = Cores.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = Tipo.bodySmall, color = Cores.Muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        Toggle(checked, enabled)
    }
}

/** Valor com − e +: as durações do pomodoro */
@Composable
fun StepperRow(title: String, value: String, onMinus: () -> Unit, onPlus: () -> Unit, canMinus: Boolean = true, canPlus: Boolean = true) {
    Column(
        Modifier.fillMaxWidth().clip(PillShape).background(Cores.Surface).padding(horizontal = 14.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, style = Tipo.bodySmall, color = Cores.Muted, maxLines = 1, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            RoundButton(br.app.coado.shared.R.drawable.ic_remove, "menos", onMinus, size = 30.dp, enabled = canMinus)
            Text(value, style = Tipo.numeral.copy(fontSize = 20.sp), color = Cores.Ink)
            RoundButton(br.app.coado.shared.R.drawable.ic_add, "mais", onPlus, size = 30.dp, enabled = canPlus)
        }
    }
}

/** Chip de escolha (categoria, modo) */
@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = Cores.Brand600, maxLines: Int = 1) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(CircleShape)
            .background(if (selected) color else Cores.Surface2)
            .border(1.dp, if (selected) color else Cores.Line, CircleShape)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .heightIn(min = 28.dp)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(text, style = Tipo.bodySmall.copy(fontSize = 11.sp), color = if (selected) Cores.Brand50 else Cores.Ink, maxLines = maxLines, textAlign = TextAlign.Center)
    }
}

@Composable
fun ColorDot(color: Color, size: Dp = 10.dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).clip(CircleShape).background(color))
}

/** A barra de progresso do site: trilho e preenchimento arredondados */
@Composable
fun Bar(value: Float, color: Color = Cores.Brand500, modifier: Modifier = Modifier, height: Dp = 5.dp, track: Color = Cores.Line) {
    Canvas(modifier.fillMaxWidth().height(height)) {
        val r = size.height / 2f
        drawRoundRect(track, cornerRadius = androidx.compose.ui.geometry.CornerRadius(r, r))
        val w = size.width * value.coerceIn(0f, 1f)
        if (w > 0f) drawRoundRect(color, size = androidx.compose.ui.geometry.Size(w, size.height), cornerRadius = androidx.compose.ui.geometry.CornerRadius(r, r))
    }
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, style: TextStyle = Tipo.label, color: Color = Cores.Muted) {
    Text(text.uppercase(), style = style, color = color, modifier = modifier, maxLines = 1)
}

/** Um vão fixo para alinhar colunas */
@Composable
fun HGap(width: Dp) = Spacer(Modifier.width(width))
