package br.app.coado.shared.timer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import br.app.coado.shared.CoadoCore
import br.app.coado.shared.model.Dates
import br.app.coado.shared.model.Draft
import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.Review
import br.app.coado.shared.model.Study
import br.app.coado.shared.model.SubjectLite
import br.app.coado.shared.model.uid
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * O motor do pomodoro. O estado é só carimbos de tempo ([TimerState]); aqui ficam as transições,
 * o alarme exato do fim da etapa, a notificação da sessão e os avisos (vibração e som).
 * Nada roda enquanto a sessão corre: o processo pode morrer que o alarme acorda ele.
 */
class TimerEngine(private val app: CoadoCore) {
    val state: StateFlow<TimerState> get() = app.store.timer

    suspend fun start(subject: SubjectLite, cycleItemId: String?, mode: Mode, categoryId: String = "teoria", topicId: String? = null, assessmentId: String? = null) {
        app.store.awaitLoaded()
        val now = System.currentTimeMillis()
        val next = TimerState.begin(now, app.store.effectivePrefs(), mode, subject.id, subject.name, subject.color, cycleItemId, categoryId, topicId, assessmentId)
        apply(next)
        haptic(TICK)
    }

    suspend fun toggle() {
        val s = state.value
        if (!s.active) return
        val now = System.currentTimeMillis()
        apply(if (s.running) s.pause(now) else s.start(now))
        haptic(TICK)
    }

    /** Pula a etapa (só em pomodoro) */
    suspend fun skip() {
        val s = state.value
        if (!s.active || s.mode != Mode.POMODORO) return
        apply(s.advance(System.currentTimeMillis(), s.running))
        haptic(TICK)
    }

    /** O alarme do fim da etapa chegou (ou o processo acordou depois dele) */
    suspend fun onAlarm() {
        app.store.awaitLoaded()
        val s = state.value
        if (!s.active || !s.running || s.mode != Mode.POMODORO) return
        val now = System.currentTimeMillis()
        if (!s.finishedPhase(now)) {
            // acordou cedo: remarca
            scheduleAlarm(s)
            return
        }
        val prefs = app.store.prefs.value
        val wasStudy = s.phase == Phase.STUDY
        apply(s.advance(now, prefs.autoContinue))
        if (prefs.vibrate) haptic(if (wasStudy) STUDY_DONE else BREAK_DONE)
        if (app.store.effectivePrefs().sound) beep()
        Log.i(TAG, "etapa concluída: ${s.phase} → ${state.value.phase} (rodada ${state.value.round})")
    }

    /** Encerra a sessão e deixa o rascunho para o registro; null se não havia nada a registrar */
    suspend fun finish(): Draft? {
        val s = state.value
        if (!s.active) return null
        val now = System.currentTimeMillis()
        val seconds = (s.studiedMs(now) / 1000).toInt()
        val draft = if (seconds >= 60) {
            Draft(
                subjectId = s.subjectId,
                subjectName = s.subjectName,
                subjectColor = s.subjectColor,
                seconds = seconds,
                startedAt = s.startedAt,
                cycleItemId = s.cycleItemId,
                categoryId = s.categoryId,
                topicId = s.topicId,
                mode = s.mode,
                rounds = if (s.phase == Phase.STUDY && s.mode == Mode.POMODORO) s.round - 1 else s.round,
                assessmentId = s.assessmentId,
            )
        } else null
        app.store.setDraft(draft)
        apply(TimerState())
        haptic(TICK)
        return draft
    }

    suspend fun discard() {
        app.store.setDraft(null)
        if (state.value.active) apply(TimerState())
    }

    /**
     * Grava o estudo da sessão encerrada, como o formulário do site: revisões opcionais nos
     * intervalos da conta. Fica pendente até a sincronização.
     */
    suspend fun register(
        draft: Draft,
        categoryId: String,
        hits: Int,
        misses: Int,
        countInPlanning: Boolean,
        scheduleReviews: Boolean,
        assessmentId: String? = draft.assessmentId,
    ) {
        val snapshot = app.store.snapshot.value
        val planId = snapshot?.plan?.id ?: throw IllegalStateException("Sem plano ativo.")
        val id = uid()
        val date = Dates.dateOf(draft.startedAt)
        val study = Study(
            id = id,
            planId = planId,
            subjectId = draft.subjectId,
            topicId = draft.topicId,
            assessmentId = assessmentId,
            categoryId = categoryId,
            date = date,
            time = Dates.timeOf(draft.startedAt),
            duration = draft.seconds,
            hits = hits.coerceAtLeast(0),
            misses = misses.coerceAtLeast(0),
            countInPlanning = countInPlanning,
            createdAt = Dates.iso(System.currentTimeMillis()),
        )
        val reviews = if (scheduleReviews) {
            snapshot.reviewIntervals.map { interval ->
                Review(id = uid(), planId = planId, studyId = id, subjectId = draft.subjectId, topicId = draft.topicId, dueDate = Dates.addDays(date, interval.toLong()), interval = interval)
            }
        } else emptyList()
        app.store.addPending(listOf(study), reviews)
        app.store.setDraft(null)
        app.sync.enqueue()
    }

    /** Depois do boot ou de abrir o app: remarca o alarme ou aplica a etapa que venceu com tudo desligado */
    suspend fun restore() {
        app.store.awaitLoaded()
        val s = state.value
        if (!s.active) {
            TimerService.stop(app)
            return
        }
        if (s.running && s.finishedPhase(System.currentTimeMillis())) onAlarm() else apply(s)
    }

    private suspend fun apply(next: TimerState) {
        app.store.setTimer(next)
        if (next.active && next.running && next.mode == Mode.POMODORO) scheduleAlarm(next) else cancelAlarm()
        if (next.active) TimerService.update(app) else TimerService.stop(app)
    }

    private fun scheduleAlarm(s: TimerState) {
        val at = s.phaseEndAt ?: return
        val manager = app.getSystemService(AlarmManager::class.java) ?: return
        val exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()
        if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent())
        else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent())
    }

    private fun cancelAlarm() {
        app.getSystemService(AlarmManager::class.java)?.cancel(alarmIntent())
    }

    private fun alarmIntent(): PendingIntent = PendingIntent.getBroadcast(
        app,
        0,
        Intent(app, TimerReceiver::class.java).setAction(TimerReceiver.ACTION_ALARM),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun haptic(pattern: LongArray) {
        if (!app.store.prefs.value.vibrate) return
        val vibrator = app.getSystemService(Vibrator::class.java) ?: return
        runCatching { vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1)) }
    }

    private fun beep() {
        app.scope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70)
                    tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 400)
                    delay(500)
                    tone.release()
                }
            }
        }
    }

    companion object {
        private const val TAG = "CoadoTimer"
        val TICK = longArrayOf(0, 30)
        /** fim do estudo: três toques, o último longo */
        val STUDY_DONE = longArrayOf(0, 120, 90, 120, 90, 320)
        /** fim da pausa: dois toques curtos */
        val BREAK_DONE = longArrayOf(0, 90, 120, 90)
    }
}
