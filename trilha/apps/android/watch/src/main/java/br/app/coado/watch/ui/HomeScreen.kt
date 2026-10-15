package br.app.coado.watch.ui

import br.app.coado.shared.model.WatchAssessment
import br.app.coado.shared.Marca
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.Text
import br.app.coado.shared.R
import br.app.coado.shared.data.SyncStatus
import br.app.coado.shared.model.CycleProgressItem
import br.app.coado.shared.model.LocalPrefs
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.Transport
import br.app.coado.shared.model.fmtDuration
import br.app.coado.shared.model.fmtMinutes
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.Tipo
import br.app.coado.shared.ui.StudyArt
import br.app.coado.shared.ui.parseColor
import java.time.LocalTime

private fun greeting(): String {
    val h = LocalTime.now().hour
    return when {
        h < 5 -> "Madrugada produtiva"
        h < 12 -> "Bom dia"
        h < 18 -> "Boa tarde"
        else -> "Boa noite"
    }
}

/** A faixa de boas-vindas do site, no pulso: saudação, sequência e a próxima sessão do ciclo */
@Composable
fun HomeScreen(
    view: Overview,
    prefs: LocalPrefs,
    pendingCount: Int,
    syncStatus: SyncStatus,
    timerActive: Boolean,
    onStartNext: (CycleProgressItem) -> Unit,
    onStartAssessment: (WatchAssessment) -> Unit,
    onSubjects: () -> Unit,
    onProgress: () -> Unit,
    onSettings: () -> Unit,
    onTimer: () -> Unit,
    onSync: () -> Unit,
) {
    val animate = LocalAnimations.current
    val c = view.constancy
    val line = when {
        c.current > 0 -> "${c.current} ${if (c.current == 1) "dia" else "dias"} seguidos"
        c.daysSinceLast == null -> "Registre o primeiro estudo."
        else -> "Faz ${c.daysSinceLast} ${if (c.daysSinceLast == 1) "dia" else "dias"} sem estudar."
    }
    val connected = view.snapshot != null
    val next = view.next

    WheelScreen {
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
                StudyArt(Modifier.size(54.dp), level = 1f, resting = true, animate = animate)
                Text(Marca.SLUG, style = Tipo.title.copy(fontSize = 20.sp), color = Cores.Ink)
                Text("${greeting()}. $line", style = Tipo.bodySmall, color = Cores.Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp))
            }
        }

        if (timerActive) {
            item { PillButton("Voltar à sessão", onTimer, icon = R.drawable.ic_play) }
        }

        if (!connected) {
            item {
                Pill(
                    title = if (prefs.transport == Transport.PHONE) "Abra o ${Marca.NOME} no celular" else "Parear com a conta",
                    subtitle = if (prefs.transport == Transport.PHONE) "o relógio recebe seus estudos por ele" else "Configurações → Relógio no site",
                    leading = { Icon(painterResource(if (prefs.transport == Transport.PHONE) R.drawable.ic_phone else R.drawable.ic_link), null, tint = Cores.Brand300, modifier = Modifier.size(18.dp)) },
                    onClick = onSettings,
                )
            }
            item { PillButton("Buscar agora", onSync, icon = R.drawable.ic_sync, primary = false, enabled = syncStatus !is SyncStatus.Syncing) }
        } else if (view.plan == null) {
            note("Crie um plano de estudos no site para começar.")
        } else {
            // modo universidade: a avaliação mais próxima vem antes do ciclo; tocar começa a estudar para ela
            val prox = view.nextAssessment
            if (view.universidade && prox != null) {
                item {
                    Pill(
                        title = prox.name,
                        subtitle = "${view.subjectName(prox.subjectId)} · ${view.quando(prox.date)}",
                        leading = { ColorDot(parseColor(view.subjectColor(prox.subjectId)), 12.dp) },
                        trailing = { Icon(painterResource(R.drawable.ic_play), "Estudar para esta avaliação", tint = Cores.Brand300, modifier = Modifier.size(20.dp)) },
                        tint = Cores.Surface2,
                        onClick = { onStartAssessment(prox) },
                    )
                }
            }
            if (view.universidade && view.lateAssessments > 0) {
                note("${view.lateAssessments} ${if (view.lateAssessments == 1) "avaliação atrasada" else "avaliações atrasadas"}", color = Cores.Warn)
            }
            item {
                if (next != null) {
                    val color = parseColor(view.subjectColor(next.subjectId))
                    val remaining = (next.duration * 60 - next.studied).coerceAtLeast(0)
                    Pill(
                        title = view.subjectName(next.subjectId),
                        subtitle = "próxima do ciclo · faltam ${fmtDuration(remaining)} de ${fmtMinutes(next.duration)}",
                        leading = { ColorDot(color, 12.dp) },
                        trailing = { Icon(painterResource(R.drawable.ic_play), "Iniciar", tint = Cores.Brand300, modifier = Modifier.size(20.dp)) },
                        tint = Cores.Surface2,
                        onClick = { onStartNext(next) },
                    )
                } else if (view.cycleDone) {
                    Pill("Ciclo concluído!", subtitle = "recomece no site para a próxima volta", tint = Cores.Surface2, onClick = onSubjects)
                } else {
                    Pill("Escolher disciplina", subtitle = "sem ciclo montado: comece por uma", leading = { Icon(painterResource(R.drawable.ic_list), null, tint = Cores.Brand300, modifier = Modifier.size(18.dp)) }, onClick = onSubjects)
                }
            }
            item {
                val t = view.todayTotals
                val goal = view.plan?.weeklyGoal?.minutes ?: 0
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                        Label("hoje")
                        Text(fmtDuration(t.seconds), style = Tipo.numeral.copy(fontSize = 18.sp), color = Cores.Ink)
                    }
                    if (goal > 0) {
                        Bar(view.weekTotals.seconds / (goal * 60f), color = if (view.weekTotals.seconds >= goal * 60) Cores.Ok else Cores.Brand500)
                        Text("semana: ${fmtDuration(view.weekTotals.seconds)} de ${fmtMinutes(goal)}", style = Tipo.bodySmall, color = Cores.Muted)
                    } else {
                        Text("${t.sessions} ${if (t.sessions == 1) "sessão" else "sessões"} hoje", style = Tipo.bodySmall, color = Cores.Muted)
                    }
                }
            }
            if (next != null) item { PillButton("Outra disciplina", onSubjects, icon = R.drawable.ic_list, primary = false) }
            item { PillButton("Progresso", onProgress, icon = R.drawable.ic_chart, primary = false) }
        }

        if (pendingCount > 0) {
            note("$pendingCount ${if (pendingCount == 1) "estudo" else "estudos"} para enviar", color = Cores.Warn)
        }
        if (syncStatus is SyncStatus.Error) note(syncStatus.message, color = Cores.Bad)

        item { PillButton("Ajustes", onSettings, icon = R.drawable.ic_settings, primary = false) }
        gap(12.dp)
    }
}

@Composable
fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        StudyArt(Modifier.size(64.dp), level = 0.4f, flowing = true, animate = LocalAnimations.current)
    }
}
