package br.app.coado.phone.timer

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.app.coado.phone.CoadoPhoneApp
import br.app.coado.shared.R
import br.app.coado.shared.model.Dates
import br.app.coado.shared.model.Draft
import br.app.coado.shared.model.LocalPrefs
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.Overview
import br.app.coado.shared.model.SubjectLite
import br.app.coado.shared.model.fmtClock
import br.app.coado.shared.model.fmtDuration
import br.app.coado.shared.model.fmtMinutes
import br.app.coado.shared.timer.Phase
import br.app.coado.shared.timer.TimerState
import br.app.coado.shared.timer.label
import br.app.coado.shared.ui.Cores
import br.app.coado.shared.ui.StudyArt
import br.app.coado.shared.ui.ProgressRing
import br.app.coado.shared.ui.RoundDots
import br.app.coado.shared.ui.parseColor
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Escolha → sessão → registro → pronto */
@Composable
fun PomodoroFlow(
    app: CoadoPhoneApp,
    view: Overview,
    prefs: LocalPrefs,
    timer: TimerState,
    draft: Draft?,
    request: TimerRequest,
    ensureNotifications: () -> Unit,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var saved by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(PomodoroActivity.Overlay)) {
        when {
            saved -> SavedPane(view) { saved = false; onClose() }
            draft != null -> RegisterPane(
                draft = draft,
                view = view,
                onSave = { category, hits, misses, counts, reviews ->
                    scope.launch {
                        runCatching { app.engine.register(draft, category, hits, misses, counts, reviews) }
                        saved = true
                    }
                },
                onDiscard = { scope.launch { app.engine.discard() } },
            )
            timer.active -> SessionPane(
                state = timer,
                animate = prefs.animations,
                onToggle = { scope.launch { app.engine.toggle() } },
                onSkip = { scope.launch { app.engine.skip() } },
                onFinish = { scope.launch { if (app.engine.finish() == null) onClose() } },
                onClose = onClose,
            )
            else -> PickPane(
                view = view,
                prefs = prefs,
                request = request,
                onMode = { m -> scope.launch { app.store.updatePrefs { it.copy(mode = m) } } },
                onStart = { subject, cycleItemId, category ->
                    ensureNotifications()
                    scope.launch { app.engine.start(subject, cycleItemId, prefs.mode, category, request.topicId) }
                },
                onClose = onClose,
            )
        }
    }
}

@Composable
private fun TopBar(title: String, onClose: () -> Unit, trailing: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = onClose) { Icon(painterResource(R.drawable.ic_close), "Fechar", tint = Cores.Muted) }
        Text(title, style = MaterialTheme.typography.titleLarge, color = Cores.Ink, modifier = Modifier.weight(1f))
        trailing()
    }
}

@Composable
private fun PickPane(
    view: Overview,
    prefs: LocalPrefs,
    request: TimerRequest,
    onMode: (Mode) -> Unit,
    onStart: (SubjectLite, String?, String) -> Unit,
    onClose: () -> Unit,
) {
    var selected by rememberSaveable(request.subjectId) { mutableStateOf(request.subjectId ?: view.next?.subjectId) }
    val category = request.categoryId ?: "teoria"
    val pendingItems = view.cycle.filter { !it.done }

    Column(Modifier.fillMaxSize().systemBarsPadding()) {
        TopBar("Pomodoro", onClose)
        if (view.plan == null) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Crie um plano de estudos no site para começar.", color = Cores.Muted, textAlign = TextAlign.Center, modifier = Modifier.padding(32.dp))
            }
            return@Column
        }
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ModeChip("Pomodoro", prefs.mode == Mode.POMODORO) { onMode(Mode.POMODORO) }
            ModeChip("Cronômetro livre", prefs.mode == Mode.FREE) { onMode(Mode.FREE) }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (pendingItems.isNotEmpty()) {
                item { SectionLabel("Próximas do ciclo") }
                items(pendingItems, key = { "c" + it.id }) { item ->
                    val subject = view.subject(item.subjectId) ?: return@items
                    SubjectRow(
                        subject = subject,
                        detail = "${fmtDuration(item.studied)} de ${fmtMinutes(item.duration)}",
                        progress = (item.studied / (item.duration * 60f)).coerceIn(0f, 1f),
                        selected = selected == subject.id,
                        onClick = { selected = subject.id },
                    )
                }
            }
            item { SectionLabel("Todas as disciplinas") }
            items(view.subjects, key = { "s" + it.id }) { subject ->
                SubjectRow(subject = subject, detail = null, progress = null, selected = selected == subject.id, onClick = { selected = subject.id })
            }
        }
        val subject = selected?.let { view.subject(it) }
        Button(
            onClick = { subject?.let { onStart(it, view.cycle.firstOrNull { c -> !c.done && c.subjectId == it.id }?.id, category) } },
            enabled = subject != null,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Cores.Brand600, contentColor = Cores.Brand50, disabledContainerColor = Cores.Surface2, disabledContentColor = Cores.Muted),
            modifier = Modifier.fillMaxWidth().padding(16.dp).height(54.dp),
        ) {
            Icon(painterResource(R.drawable.ic_play), null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(if (subject != null) "Começar · ${subject.name}" else "Escolha uma disciplina", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun ModeChip(text: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(text) },
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Cores.Brand700, selectedLabelColor = Cores.Brand50, labelColor = Cores.Muted, containerColor = Cores.Surface2),
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = Cores.Muted, modifier = Modifier.padding(top = 8.dp, bottom = 2.dp))
}

@Composable
private fun SubjectRow(subject: SubjectLite, detail: String?, progress: Float?, selected: Boolean, onClick: () -> Unit) {
    val color = parseColor(subject.color)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) Cores.Surface2 else Cores.Surface)
            .border(1.dp, if (selected) Cores.Brand500 else Cores.Line, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.size(12.dp).clip(CircleShape).background(color))
            Text(subject.name, style = MaterialTheme.typography.titleSmall, color = Cores.Ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (detail != null) Text(detail, style = MaterialTheme.typography.bodySmall, color = Cores.Muted)
        }
        if (progress != null) {
            Box(Modifier.fillMaxWidth().height(5.dp).clip(CircleShape).background(Cores.Line)) {
                Box(Modifier.fillMaxWidth(progress).height(5.dp).clip(CircleShape).background(color))
            }
        }
    }
}

@Composable
private fun SessionPane(state: TimerState, animate: Boolean, onToggle: () -> Unit, onSkip: () -> Unit, onFinish: () -> Unit, onClose: () -> Unit) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(state.running, state.phase, state.segmentStartedAt) {
        now = System.currentTimeMillis()
        if (!state.running) return@LaunchedEffect
        while (true) {
            delay(1000 - System.currentTimeMillis() % 1000)
            now = System.currentTimeMillis()
        }
    }
    val subjectColor = parseColor(state.subjectColor)
    val isBreak = state.isBreak
    val ringColor = if (isBreak) Cores.Ok else subjectColor
    val progress = if (state.mode == Mode.FREE) 0f else state.progress(now)
    val display = if (state.mode == Mode.FREE) fmtClock(state.elapsedMs(now)) else fmtClock(state.remainingMs(now))

    Column(Modifier.fillMaxSize().systemBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
        TopBar(if (state.mode == Mode.FREE) "Cronômetro" else "Pomodoro", onClose)
        Spacer(Modifier.weight(1f))
        Box(Modifier.size(280.dp), contentAlignment = Alignment.Center) {
            ProgressRing(Modifier.fillMaxSize(), progress = progress, color = ringColor, track = Cores.Line, stroke = 10.dp)
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(30.dp)) {
                StudyArt(
                    Modifier.size(84.dp),
                    level = if (isBreak || state.mode == Mode.FREE) 1f else progress,
                    resting = isBreak || state.mode == Mode.FREE,
                    flowing = !isBreak && state.mode == Mode.POMODORO && state.running,
                    animate = animate && state.running,
                    sand = subjectColor,
                )
                AnimatedContent(
                    targetState = if (state.mode == Mode.FREE) "Livre" else state.phase.label,
                    transitionSpec = { (fadeIn(tween(220)) + scaleIn(tween(220), initialScale = 0.7f)) togetherWith fadeOut(tween(120)) },
                    label = "etapa",
                ) { label ->
                    Text(label.uppercase(), style = MaterialTheme.typography.labelSmall, color = if (isBreak) Cores.Ok else Cores.Brand300)
                }
                Text(display, style = MaterialTheme.typography.displayLarge.copy(fontSize = if (display.length > 5) 50.sp else 64.sp), color = if (state.running) Cores.Ink else Cores.Muted)
                if (state.mode == Mode.POMODORO) RoundDots(state.round, state.rounds, subjectColor, dot = 8.dp)
            }
        }
        Spacer(Modifier.height(16.dp))
        Text(state.subjectName, style = MaterialTheme.typography.titleMedium, color = Cores.Ink, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 32.dp))
        Text(
            if (state.mode == Mode.POMODORO) "Sessão ${state.round} de ${state.rounds} · estudado ${fmtDuration((state.studiedMs(now) / 1000).toInt())}" else "estudado ${fmtDuration((state.studiedMs(now) / 1000).toInt())}",
            style = MaterialTheme.typography.bodyMedium,
            color = Cores.Muted,
        )
        if (state.mode == Mode.POMODORO) {
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (p in Phase.entries) {
                    val on = p == state.phase
                    Box(
                        Modifier.clip(CircleShape).background(if (on) Cores.Brand600 else Color.Transparent).border(1.dp, if (on) Cores.Brand500 else Cores.Line, CircleShape).padding(horizontal = 14.dp, vertical = 5.dp),
                    ) { Text(p.label, style = MaterialTheme.typography.labelMedium, color = if (on) Cores.Brand50 else Cores.Muted) }
                }
            }
        }
        Spacer(Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 36.dp)) {
            CircleButton(R.drawable.ic_stop, "Finalizar e registrar", onFinish, size = 56.dp, color = Cores.Brand600, tint = Cores.Brand50)
            CircleButton(if (state.running) R.drawable.ic_pause else R.drawable.ic_play, if (state.running) "Pausar" else "Continuar", onToggle, size = 72.dp, color = Cores.Brand100, tint = Cores.Bg)
            CircleButton(R.drawable.ic_skip, "Pular etapa", onSkip, size = 56.dp, color = Color.Transparent, tint = Cores.Ink, border = true, enabled = state.mode == Mode.POMODORO)
        }
    }
}

@Composable
private fun CircleButton(icon: Int, label: String, onClick: () -> Unit, size: androidx.compose.ui.unit.Dp, color: Color, tint: Color, border: Boolean = false, enabled: Boolean = true) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .alpha(if (enabled) 1f else 0.4f)
            .clip(CircleShape)
            .background(color)
            .then(if (border) Modifier.border(1.dp, Cores.Line, CircleShape) else Modifier)
            .clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
    ) { Icon(painterResource(icon), label, tint = tint, modifier = Modifier.size(size * 0.42f)) }
}

@Composable
private fun RegisterPane(draft: Draft, view: Overview, onSave: (String, Int, Int, Boolean, Boolean) -> Unit, onDiscard: () -> Unit) {
    var category by rememberSaveable { mutableStateOf(draft.categoryId) }
    var hits by rememberSaveable { mutableIntStateOf(0) }
    var misses by rememberSaveable { mutableIntStateOf(0) }
    var counts by rememberSaveable { mutableStateOf(true) }
    var reviews by rememberSaveable { mutableStateOf(false) }
    var confirmDiscard by rememberSaveable { mutableStateOf(false) }
    val color = parseColor(draft.subjectColor)
    val intervals = view.snapshot?.reviewIntervals.orEmpty()

    Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        TopBar("Registrar estudo", onClose = { confirmDiscard = true })
        StudyArt(Modifier.size(90.dp), level = 1f, resting = true, sand = color)
        Text(fmtDuration(draft.seconds), style = MaterialTheme.typography.headlineMedium, color = Cores.Ink)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(color))
            Text(draft.subjectName, style = MaterialTheme.typography.titleMedium, color = Cores.Ink)
        }
        Text("${Dates.fmtDate(Dates.dateOf(draft.startedAt))} · ${Dates.timeOf(draft.startedAt)}" + if (draft.rounds > 0) " · ${draft.rounds} ${if (draft.rounds == 1) "pomodoro" else "pomodoros"}" else "", style = MaterialTheme.typography.bodySmall, color = Cores.Muted)

        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionLabel("Categoria")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                view.categories.take(4).forEach { c -> ModeChip(c.name, category == c.id) { category = c.id } }
            }
            SectionLabel("Questões")
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Counter("Acertos", hits, Modifier.weight(1f)) { hits = it }
                Counter("Erros", misses, Modifier.weight(1f)) { misses = it }
            }
            SwitchRow("Conta no ciclo", counts) { counts = it }
            SwitchRow("Agendar revisões" + if (intervals.isNotEmpty()) " (${intervals.joinToString(", ")} dias)" else "", reviews, enabled = intervals.isNotEmpty()) { reviews = it }
            Button(
                onClick = { onSave(category, hits, misses, counts, reviews) },
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Cores.Brand600, contentColor = Cores.Brand50),
                modifier = Modifier.fillMaxWidth().height(54.dp),
            ) { Text("Salvar estudo", style = MaterialTheme.typography.labelLarge) }
            if (confirmDiscard) {
                Text("Descartar o tempo em andamento?", color = Cores.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { confirmDiscard = false }, modifier = Modifier.weight(1f)) { Text("Voltar") }
                    Button(onClick = onDiscard, colors = ButtonDefaults.buttonColors(containerColor = Cores.Bad, contentColor = Cores.Bg), modifier = Modifier.weight(1f)) { Text("Descartar") }
                }
            } else {
                TextButton(onClick = { confirmDiscard = true }, modifier = Modifier.fillMaxWidth()) { Text("Descartar", color = Cores.Bad) }
            }
        }
    }
}

@Composable
private fun Counter(label: String, value: Int, modifier: Modifier = Modifier, onChange: (Int) -> Unit) {
    Column(modifier.clip(RoundedCornerShape(16.dp)).background(Cores.Surface).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = Cores.Muted)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            CircleButton(R.drawable.ic_remove, "menos", { onChange((value - 1).coerceAtLeast(0)) }, size = 36.dp, color = Cores.Surface2, tint = Cores.Ink, enabled = value > 0)
            Text(value.toString(), style = MaterialTheme.typography.headlineSmall, color = Cores.Ink)
            CircleButton(R.drawable.ic_add, "mais", { onChange(value + 1) }, size = 36.dp, color = Cores.Surface2, tint = Cores.Ink)
        }
    }
}

@Composable
private fun SwitchRow(label: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Cores.Surface).padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = if (enabled) Cores.Ink else Cores.Muted, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun SavedPane(view: Overview, onDone: () -> Unit) {
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        StudyArt(Modifier.size(140.dp), level = 1f, resting = true)
        Text("Estudo registrado", style = MaterialTheme.typography.headlineSmall, color = Cores.Ink, textAlign = TextAlign.Center)
        Text("hoje: ${fmtDuration(view.todayTotals.seconds)}" + (view.constancy.current.takeIf { it > 1 }?.let { " · $it dias seguidos" } ?: ""), style = MaterialTheme.typography.bodyMedium, color = Cores.Muted, modifier = Modifier.padding(top = 6.dp))
        Spacer(Modifier.height(24.dp))
        Button(onClick = onDone, shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = Cores.Brand600, contentColor = Cores.Brand50)) { Text("Voltar ao Coado") }
    }
}
