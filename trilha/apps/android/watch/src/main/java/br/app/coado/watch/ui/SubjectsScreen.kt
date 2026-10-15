package br.app.coado.watch.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Icon
import br.app.coado.shared.R
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.SubjectLite
import br.app.coado.shared.model.fmtDuration
import br.app.coado.shared.model.fmtMinutes
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.parseColor

/** A sequência do ciclo (pendentes primeiro) e todas as disciplinas; tocar começa a sessão */
@Composable
fun SubjectsScreen(
    view: Overview,
    mode: Mode,
    onMode: (Mode) -> Unit,
    onStart: (SubjectLite, String?) -> Unit,
) {
    val pendingItems = view.cycle.filter { !it.done }
    val doneCount = view.cycle.size - pendingItems.size

    WheelScreen {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp, androidx.compose.ui.Alignment.CenterHorizontally)) {
                Chip("Pomodoro", mode == Mode.POMODORO, { onMode(Mode.POMODORO) })
                Chip("Livre", mode == Mode.FREE, { onMode(Mode.FREE) })
            }
        }

        if (pendingItems.isNotEmpty()) {
            section("Ciclo")
            items(pendingItems, key = { "c-" + it.id }) { item ->
                val subject = view.subject(item.subjectId)
                val color = parseColor(view.subjectColor(item.subjectId))
                Pill(
                    title = view.subjectName(item.subjectId),
                    subtitle = "${fmtDuration(item.studied)} de ${fmtMinutes(item.duration)}",
                    leading = { ColorDot(color, 12.dp) },
                    trailing = { Icon(painterResource(R.drawable.ic_play), "Iniciar", tint = Cores.Brand300, modifier = Modifier.size(18.dp)) },
                    enabled = subject != null,
                    onClick = { subject?.let { onStart(it, item.id) } },
                )
            }
            if (doneCount > 0) note("$doneCount ${if (doneCount == 1) "sessão concluída" else "sessões concluídas"} nesta volta")
        } else if (view.cycle.isNotEmpty()) {
            note("Ciclo concluído. Recomece no site para a próxima volta.")
        }

        section("Disciplinas")
        if (view.subjects.isEmpty()) note("Nenhuma disciplina no plano ativo.")
        items(view.subjects, key = { "s-" + it.id }) { subject ->
            Pill(
                title = subject.name,
                leading = { ColorDot(parseColor(subject.color), 12.dp) },
                trailing = { Icon(painterResource(R.drawable.ic_play), "Iniciar", tint = Cores.Muted, modifier = Modifier.size(18.dp)) },
                onClick = { onStart(subject, view.cycle.firstOrNull { !it.done && it.subjectId == subject.id }?.id) },
            )
        }
        gap(12.dp)
    }
}
