package br.app.coado.watch.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import br.app.coado.shared.R
import br.app.coado.shared.model.Dates
import br.app.coado.shared.model.Draft
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.fmtDuration
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.Tipo
import br.app.coado.shared.ui.StudyArt
import br.app.coado.shared.ui.parseColor

/** O formulário de registro do site, reduzido ao que cabe no pulso: categoria, questões, revisões */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FinishScreen(
    draft: Draft,
    view: Overview,
    onSave: (categoryId: String, hits: Int, misses: Int, countInPlanning: Boolean, scheduleReviews: Boolean, assessmentId: String?) -> Unit,
    onDiscard: () -> Unit,
) {
    var category by rememberSaveable { mutableStateOf(draft.categoryId) }
    var hits by rememberSaveable { mutableIntStateOf(0) }
    var misses by rememberSaveable { mutableIntStateOf(0) }
    var counts by rememberSaveable { mutableStateOf(true) }
    var reviews by rememberSaveable { mutableStateOf(false) }
    var confirmDiscard by rememberSaveable { mutableStateOf(false) }
    var assessment by rememberSaveable { mutableStateOf(draft.assessmentId) }
    val assessments = if (view.universidade) view.assessmentsOf(draft.subjectId) else emptyList()
    val color = parseColor(draft.subjectColor)

    WheelScreen {
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
                StudyArt(Modifier.size(44.dp), level = 1f, resting = true, animate = LocalAnimations.current, sand = color)
                Text(fmtDuration(draft.seconds), style = Tipo.numeral.copy(fontSize = 26.sp), color = Cores.Ink)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ColorDot(color, 8.dp)
                    Text(draft.subjectName, style = Tipo.subtitle, color = Cores.Ink, textAlign = TextAlign.Center)
                }
                Text(
                    "${Dates.fmtDayMonth(Dates.dateOf(draft.startedAt))} · ${Dates.timeOf(draft.startedAt)}" + if (draft.rounds > 0) " · ${draft.rounds} ${if (draft.rounds == 1) "pomodoro" else "pomodoros"}" else "",
                    style = Tipo.bodySmall,
                    color = Cores.Muted,
                )
            }
        }

        section("Categoria")
        item {
            FlowRow(
                Modifier.fillMaxWidth().padding(horizontal = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                view.categories.forEach { c ->
                    Chip(c.name, category == c.id, { category = c.id })
                }
            }
        }

        if (assessments.isNotEmpty()) {
            section("Para a avaliação")
            item {
                FlowRow(
                    Modifier.fillMaxWidth().padding(horizontal = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Chip("Nenhuma", assessment == null, { assessment = null })
                    // nome inteiro: uma por linha, até duas linhas cada
                    assessments.forEach { a -> Chip(a.name, assessment == a.id, { assessment = a.id }, Modifier.fillMaxWidth(), maxLines = 2) }
                }
            }
        }

        section("Questões")
        item { StepperRow("Acertos", hits.toString(), onMinus = { hits = (hits - 1).coerceAtLeast(0) }, onPlus = { hits++ }, canMinus = hits > 0) }
        item { StepperRow("Erros", misses.toString(), onMinus = { misses = (misses - 1).coerceAtLeast(0) }, onPlus = { misses++ }, canMinus = misses > 0) }

        gap()
        item { ToggleRow("Conta no ciclo", counts, { counts = it }) }
        item {
            val intervals = view.snapshot?.reviewIntervals.orEmpty()
            ToggleRow("Agendar revisões", reviews, { reviews = it }, subtitle = if (intervals.isEmpty()) "sem intervalos na conta" else intervals.joinToString(" · ") { "$it" } + " dias", enabled = intervals.isNotEmpty())
        }

        gap()
        item { PillButton("Salvar estudo", { onSave(category, hits, misses, counts, reviews, assessment) }, icon = R.drawable.ic_check) }
        item {
            if (confirmDiscard) {
                PillButton("Descartar mesmo?", onDiscard, icon = R.drawable.ic_close, color = Cores.Bad, textColor = Cores.Bg)
            } else {
                PillButton("Descartar", { confirmDiscard = true }, icon = R.drawable.ic_close, primary = false, textColor = Cores.Bad)
            }
        }
        gap(12.dp)
    }
}

/** O estudo foi guardado: um carimbo e o total do dia */
@Composable
fun SavedScreen(view: Overview, pendingCount: Int, onDone: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(horizontal = 24.dp)) {
            StudyArt(Modifier.size(64.dp), level = 1f, resting = true, animate = LocalAnimations.current)
            Text("Estudo registrado", style = Tipo.title, color = Cores.Ink, textAlign = TextAlign.Center)
            Text("hoje: ${fmtDuration(view.todayTotals.seconds)}" + (view.constancy.current.takeIf { it > 1 }?.let { " · $it dias seguidos" } ?: ""), style = Tipo.bodySmall, color = Cores.Muted, textAlign = TextAlign.Center)
            if (pendingCount > 0) Text("enviando quando houver conexão", style = Tipo.bodySmall, color = Cores.Warn, textAlign = TextAlign.Center)
            PillButton("Pronto", onDone, primary = false)
        }
    }
}
