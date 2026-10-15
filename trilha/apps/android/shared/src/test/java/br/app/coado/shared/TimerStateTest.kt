package br.app.coado.shared

import br.app.coado.shared.model.Mode
import br.app.coado.shared.model.TimerPrefs
import br.app.coado.shared.timer.Phase
import br.app.coado.shared.timer.TimerState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** O relógio de carimbos de tempo, com as regras do TimerOverlay do site */
class TimerStateTest {
    private val prefs = TimerPrefs(pomodoroStudy = 25, pomodoroShort = 5, pomodoroLong = 15, pomodoroRounds = 2)
    private val min = 60_000L

    private fun begin(now: Long, mode: Mode = Mode.POMODORO) =
        TimerState.begin(now, prefs, mode, "s1", "Cálculo", "#c08f5d", "c1", "teoria", null)

    @Test
    fun `conta o tempo pela diferença de carimbos e pausa sem perder nada`() {
        var s = begin(1000)
        assertEquals(10 * min, s.elapsedMs(1000 + 10 * min))
        assertEquals(15 * min, s.remainingMs(1000 + 10 * min))
        assertEquals(1000 + 25 * min, s.phaseEndAt)
        s = s.pause(1000 + 10 * min)
        assertNull(s.phaseEndAt)
        assertEquals(10 * min, s.elapsedMs(1000 + 60 * min))
        s = s.start(1000 + 60 * min)
        assertEquals(11 * min, s.elapsedMs(1000 + 61 * min))
        assertEquals(1000 + 75 * min, s.phaseEndAt)
    }

    @Test
    fun `estudo → pausa curta → estudo → pausa longa, e o estudado se acumula`() {
        var s = begin(0)
        assertEquals(Phase.STUDY, s.phase)
        s = s.advance(25 * min, keepRunning = true)
        assertEquals(Phase.SHORT, s.phase)
        assertEquals(1, s.round)
        assertEquals(25 * min, s.bankedStudyMs)
        assertEquals(25 * min, s.studiedMs(27 * min)) // pausa não conta
        s = s.advance(30 * min, keepRunning = false)
        assertEquals(Phase.STUDY, s.phase)
        assertEquals(2, s.round)
        assertFalse(s.running)
        s = s.start(40 * min).advance(65 * min, keepRunning = true)
        assertEquals(Phase.LONG, s.phase) // round 2 de 2
        assertEquals(50 * min, s.bankedStudyMs)
        s = s.advance(80 * min, keepRunning = true)
        assertEquals(Phase.STUDY, s.phase)
        assertEquals(1, s.round)
    }

    @Test
    fun `pular no meio do estudo guarda só o que foi estudado`() {
        val s = begin(0).advance(10 * min, keepRunning = true)
        assertEquals(10 * min, s.bankedStudyMs)
        assertEquals(10 * min, s.studiedMs(12 * min))
    }

    @Test
    fun `o estudo que passou do alvo com o relógio desligado vale o alvo`() {
        val s = begin(0)
        assertTrue(s.finishedPhase(26 * min))
        assertEquals(25 * min, s.advance(40 * min, keepRunning = true).bankedStudyMs)
        assertEquals(1f, s.progress(40 * min))
    }

    @Test
    fun `o modo livre só acumula`() {
        val s = begin(0, Mode.FREE)
        assertEquals(0L, s.targetMs)
        assertNull(s.phaseEndAt)
        assertFalse(s.finishedPhase(90 * min))
        assertEquals(90 * min, s.studiedMs(90 * min))
        assertEquals(0f, s.progress(90 * min))
    }
}
