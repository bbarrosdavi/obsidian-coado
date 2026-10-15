package br.app.coado.shared.timer

import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.TimerPrefs
import kotlinx.serialization.Serializable

@Serializable
enum class Phase { STUDY, SHORT, LONG }

/**
 * O relógio da sessão, feito de carimbos de tempo: nada conta segundos em segundo plano.
 * Quem lê informa o `now`; o fim da etapa é um alarme marcado para [phaseEndAt].
 * Espelha o TimerOverlay do site (apps/web/src/components/TimerOverlay.tsx).
 */
@Serializable
data class TimerState(
    /** existe uma sessão (rodando ou pausada) */
    val active: Boolean = false,
    val mode: Mode = Mode.POMODORO,
    val phase: Phase = Phase.STUDY,
    /** 1..rounds; a pausa longa fecha a rodada */
    val round: Int = 1,
    val running: Boolean = false,
    /** início do trecho corrente (epoch ms); só vale com running */
    val segmentStartedAt: Long = 0,
    /** ms da etapa corrente antes do trecho atual (pausas) */
    val accumulatedMs: Long = 0,
    /** ms de estudo das etapas de estudo já concluídas */
    val bankedStudyMs: Long = 0,
    val subjectId: String = "",
    val subjectName: String = "",
    val subjectColor: String = "#c08f5d",
    val cycleItemId: String? = null,
    val categoryId: String = "teoria",
    val topicId: String? = null,
    /** a avaliação para a qual se estuda (modo universidade) */
    val assessmentId: String? = null,
    /** início da sessão (epoch ms): vira a data e a hora do estudo */
    val startedAt: Long = 0,
    /** durações da sessão (minutos), congeladas no início */
    val study: Int = 25,
    val short: Int = 5,
    val long: Int = 15,
    val rounds: Int = 4,
) {
    fun phaseMinutes(p: Phase = phase) = when (p) {
        Phase.STUDY -> study
        Phase.SHORT -> short
        Phase.LONG -> long
    }

    /** duração da etapa; 0 no modo livre */
    val targetMs: Long get() = if (mode == Mode.FREE) 0 else phaseMinutes() * 60_000L

    val isBreak get() = mode == Mode.POMODORO && phase != Phase.STUDY

    fun elapsedMs(now: Long): Long = accumulatedMs + (if (running) (now - segmentStartedAt).coerceAtLeast(0) else 0)

    fun remainingMs(now: Long): Long = (targetMs - elapsedMs(now)).coerceAtLeast(0)

    /** 0..1 da etapa; 0 no modo livre */
    fun progress(now: Long): Float = if (targetMs == 0L) 0f else (elapsedMs(now).toFloat() / targetMs).coerceIn(0f, 1f)

    /** tempo de estudo da sessão até agora (o que será registrado) */
    fun studiedMs(now: Long): Long = bankedStudyMs + (if (mode == Mode.FREE || phase == Phase.STUDY) minOf(elapsedMs(now), if (mode == Mode.FREE) Long.MAX_VALUE else targetMs) else 0)

    /** quando a etapa termina (epoch ms), se está rodando em pomodoro */
    val phaseEndAt: Long? get() = if (active && running && mode == Mode.POMODORO) segmentStartedAt + (targetMs - accumulatedMs) else null

    fun finishedPhase(now: Long) = mode == Mode.POMODORO && elapsedMs(now) >= targetMs

    fun start(now: Long) = copy(running = true, segmentStartedAt = now)

    fun pause(now: Long) = copy(running = false, accumulatedMs = elapsedMs(now), segmentStartedAt = 0)

    /** Passa à etapa seguinte: estudo → pausa (longa a cada [rounds]); pausa → estudo da rodada seguinte */
    fun advance(now: Long, keepRunning: Boolean): TimerState {
        val next = if (phase == Phase.STUDY) {
            copy(
                bankedStudyMs = bankedStudyMs + minOf(elapsedMs(now), targetMs),
                phase = if (round % rounds == 0) Phase.LONG else Phase.SHORT,
            )
        } else {
            copy(phase = Phase.STUDY, round = if (phase == Phase.LONG) 1 else round + 1)
        }
        return next.copy(accumulatedMs = 0, running = keepRunning, segmentStartedAt = if (keepRunning) now else 0)
    }

    companion object {
        fun begin(
            now: Long,
            prefs: TimerPrefs,
            mode: Mode,
            subjectId: String,
            subjectName: String,
            subjectColor: String,
            cycleItemId: String?,
            categoryId: String,
            topicId: String?,
            assessmentId: String? = null,
        ) = TimerState(
            active = true,
            mode = mode,
            running = true,
            segmentStartedAt = now,
            startedAt = now,
            subjectId = subjectId,
            subjectName = subjectName,
            subjectColor = subjectColor,
            cycleItemId = cycleItemId,
            categoryId = categoryId,
            topicId = topicId,
            assessmentId = assessmentId,
            study = prefs.pomodoroStudy.coerceAtLeast(1),
            short = prefs.pomodoroShort.coerceAtLeast(1),
            long = prefs.pomodoroLong.coerceAtLeast(1),
            rounds = prefs.pomodoroRounds.coerceAtLeast(1),
        )
    }
}

val Phase.label: String
    get() = when (this) {
        Phase.STUDY -> "Estudo"
        Phase.SHORT -> "Pausa curta"
        Phase.LONG -> "Pausa longa"
    }
