package br.app.coado.shared.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.sin

/*
 * As ilustrações em Canvas: a ampulheta que enche enquanto se estuda e o anel de progresso.
 * As animações só rodam quando pedidas (tela acesa, animações ligadas): fora disso é um quadro parado.
 */

/** O vidro da ampulheta, no sistema de 120×110: dois bulbos e o gargalo no meio (y = 55) */
private fun glass() = Path().apply {
    moveTo(38f, 14f)
    cubicTo(38f, 36f, 55f, 44f, 57.5f, 55f)
    cubicTo(55f, 66f, 38f, 74f, 38f, 96f)
    lineTo(82f, 96f)
    cubicTo(82f, 74f, 65f, 66f, 62.5f, 55f)
    cubicTo(65f, 44f, 82f, 36f, 82f, 14f)
    close()
}

/**
 * A ampulheta. [level] é quanto da areia já desceu (0..1); com [flowing] a areia escorre pelo gargalo;
 * com [resting] ela pulsa de leve (a pausa). [animate] desligado congela tudo (modo ambiente, economia).
 */
@Composable
fun StudyArt(
    modifier: Modifier = Modifier,
    level: Float = 1f,
    resting: Boolean = false,
    flowing: Boolean = false,
    animate: Boolean = true,
    sand: Color = Cores.Brand400,
    ink: Color = Cores.Ink,
    body: Color = Cores.Surface2,
    strokeWidth: Float = 2f,
) {
    val pulseT = if (animate && resting) {
        rememberInfiniteTransition(label = "pausa")
            .animateFloat(0f, 1f, infiniteRepeatable(tween(3200, easing = LinearEasing), RepeatMode.Restart), label = "pausa").value
    } else -1f
    val flowT = if (animate && flowing) {
        rememberInfiniteTransition(label = "areia")
            .animateFloat(0f, 1f, infiniteRepeatable(tween(900, easing = LinearEasing), RepeatMode.Restart), label = "areia").value
    } else -1f
    val lvl = level.coerceIn(0f, 1f)

    Canvas(modifier) {
        val s = minOf(size.width / 120f, size.height / 110f)
        val dx = (size.width - 120f * s) / 2f
        val dy = (size.height - 110f * s) / 2f
        translate(dx, dy) {
            scale(s, s, pivot = Offset.Zero) {
                val stroke = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                // a pausa: um halo que respira atrás do vidro
                if (resting) {
                    val a = if (pulseT >= 0f) 0.06f + 0.08f * sin(pulseT * PI).toFloat() else 0.1f
                    drawCircle(sand.copy(alpha = a), radius = 46f, center = Offset(60f, 55f))
                }
                val vidro = glass()
                drawPath(vidro, body)
                clipPath(vidro) {
                    // o que falta: areia no bulbo de cima, assentada sobre o gargalo
                    if (lvl < 1f) {
                        val topo = 55f - 37f * (1f - lvl)
                        drawRect(sand, topLeft = Offset(30f, topo), size = Size(60f, 55f - topo))
                    }
                    // o que já foi: um monte no bulbo de baixo
                    if (lvl > 0f) {
                        val cume = 96f - 36f * lvl
                        drawPath(
                            Path().apply {
                                moveTo(30f, 97f)
                                lineTo(30f, cume + 7f)
                                quadraticTo(60f, cume - 5f, 90f, cume + 7f)
                                lineTo(90f, 97f)
                                close()
                            },
                            sand,
                        )
                    }
                    // o fio de areia caindo
                    if (flowT >= 0f && lvl < 1f) {
                        val cume = 96f - 36f * lvl
                        var y = 55f + 6f * flowT
                        while (y < cume) {
                            drawCircle(sand, radius = 1.3f, center = Offset(60f, y))
                            y += 6f
                        }
                    }
                }
                drawPath(vidro, ink, style = stroke)
                // as tampas de madeira
                drawRoundRect(Cores.Brand700, topLeft = Offset(32f, 7f), size = Size(56f, 7f), cornerRadius = CornerRadius(3f))
                drawRoundRect(Cores.Brand700, topLeft = Offset(32f, 96f), size = Size(56f, 7f), cornerRadius = CornerRadius(3f))
                drawRoundRect(ink, topLeft = Offset(32f, 7f), size = Size(56f, 7f), cornerRadius = CornerRadius(3f), style = stroke)
                drawRoundRect(ink, topLeft = Offset(32f, 96f), size = Size(56f, 7f), cornerRadius = CornerRadius(3f), style = stroke)
            }
        }
    }
}

/** O anel de progresso da etapa: trilho fino e arco na cor da disciplina, com a ponta redonda */
@Composable
fun ProgressRing(
    modifier: Modifier = Modifier,
    progress: Float,
    color: Color,
    track: Color = Cores.Line,
    stroke: Dp = 6.dp,
    startAngle: Float = -90f,
    endDot: Boolean = true,
) {
    Canvas(modifier) {
        drawRing(progress.coerceIn(0f, 1f), color, track, stroke.toPx(), startAngle, endDot)
    }
}

fun DrawScope.drawRing(progress: Float, color: Color, track: Color, strokeWidth: Float, startAngle: Float = -90f, endDot: Boolean = true) {
    val inset = strokeWidth / 2f
    val rect = Rect(inset, inset, size.width - inset, size.height - inset)
    drawArc(track, 0f, 360f, false, topLeft = rect.topLeft, size = rect.size, style = Stroke(strokeWidth))
    if (progress > 0f) {
        drawArc(color, startAngle, 360f * progress, false, topLeft = rect.topLeft, size = rect.size, style = Stroke(strokeWidth, cap = StrokeCap.Round))
        if (endDot) {
            val a = Math.toRadians((startAngle + 360f * progress).toDouble())
            val c = Offset(rect.center.x + rect.width / 2f * Math.cos(a).toFloat(), rect.center.y + rect.height / 2f * Math.sin(a).toFloat())
            drawCircle(Cores.Ink, radius = strokeWidth * 0.35f, center = c)
        }
    }
}

/** A rosca do ciclo (CycleDonut do site): uma fatia por sessão, na cor da disciplina */
@Composable
fun Donut(
    modifier: Modifier = Modifier,
    slices: List<Pair<Color, Float>>,
    thickness: Dp = 10.dp,
    gap: Float = 1.5f,
    track: Color = Cores.Line,
) {
    Canvas(modifier) {
        val w = thickness.toPx()
        val inset = w / 2f
        val rect = Rect(inset, inset, size.width - inset, size.height - inset)
        val total = slices.sumOf { it.second.toDouble() }.toFloat()
        if (total <= 0f) {
            drawArc(track, 0f, 360f, false, topLeft = rect.topLeft, size = rect.size, style = Stroke(w))
            return@Canvas
        }
        var angle = -90f
        val g = if (slices.size > 1) gap else 0f
        for ((color, value) in slices) {
            val sweep = 360f * value / total
            if (sweep > g) drawArc(color, angle + g / 2f, sweep - g, false, topLeft = rect.topLeft, size = rect.size, style = Stroke(w))
            angle += sweep
        }
    }
}

/** As rodadas do pomodoro: uma bolinha por sessão de estudo, cheias as já feitas */
@Composable
fun RoundDots(round: Int, rounds: Int, color: Color, modifier: Modifier = Modifier, dot: Dp = 6.dp) {
    Row(modifier) {
        for (i in 1..rounds.coerceIn(1, 12)) {
            if (i > 1) Spacer(Modifier.width(dot * 0.8f))
            Canvas(Modifier.size(dot)) {
                if (i < round) drawCircle(color)
                else if (i == round) drawCircle(color, style = Stroke(1.5f.dp.toPx()))
                else drawCircle(color.copy(alpha = 0.3f), style = Stroke(1.dp.toPx()))
            }
        }
    }
}
