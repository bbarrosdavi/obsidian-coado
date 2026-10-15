import { useEffect, useRef, useState } from 'react'
import { CloudRain, Maximize2, Minimize2, Pause, Play, Settings, SkipForward, Square, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { clsx, fmtClock } from '../lib/utils'
import { Logo } from './Layout'
import { LampArt, RainWindowArt } from './art'

type Mode = 'stopwatch' | 'countdown' | 'pomodoro'
type Phase = 'study' | 'short' | 'long'

const beep = () => {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
    o.start()
    o.stop(ctx.currentTime + 1.2)
  } catch {
    /* sem áudio */
  }
}

/** Chuva ambiente gerada com ruído filtrado (sem arquivos de áudio) */
function useRainSound() {
  const ref = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode } | null>(null)
  const [on, setOn] = useState(false)

  const stop = () => {
    ref.current?.src.stop()
    ref.current?.ctx.close()
    ref.current = null
    setOn(false)
  }

  const toggle = () => {
    if (ref.current) return stop()
    try {
      const ctx = new AudioContext()
      const len = ctx.sampleRate * 4
      const buf = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 350
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2400
      const gain = ctx.createGain()
      gain.gain.value = 0.07
      src.connect(hp).connect(lp).connect(gain).connect(ctx.destination)
      src.start()
      ref.current = { ctx, src }
      setOn(true)
    } catch {
      /* sem áudio */
    }
  }

  useEffect(() => stop, [])
  return { on, toggle, stop }
}

export function TimerOverlay() {
  const { timer, closeTimer, openStudy, subjects, topicsOf, state, update } = useStore()
  const prefs = state.timerPrefs

  const [mode, setMode] = useState<Mode>('stopwatch')
  const [minimized, setMinimized] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')

  // relógio baseado em timestamps: elapsed acumulado + início da corrida atual
  const [running, setRunning] = useState(false)
  const [accum, setAccum] = useState(0)
  const startRef = useRef<number | null>(null)
  const [, force] = useState(0)

  // pomodoro
  const rain = useRainSound()
  const [phase, setPhase] = useState<Phase>('study')
  const [round, setRound] = useState(1)
  /** tempo de estudo acumulado nas fases "study" concluídas */
  const [studiedPomodoro, setStudiedPomodoro] = useState(0)

  useEffect(() => {
    if (timer) {
      setSubjectId(timer.subjectId ?? '')
      setTopicId(timer.topicId ?? '')
      setMinimized(false)
    }
  }, [timer])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => force((x) => x + 1), 250)
    return () => clearInterval(t)
  }, [running])

  const elapsed = accum + (running && startRef.current ? (Date.now() - startRef.current) / 1000 : 0)

  const phaseTarget = (p: Phase) => (p === 'study' ? prefs.pomodoroStudy : p === 'short' ? prefs.pomodoroShort : prefs.pomodoroLong) * 60
  const target = mode === 'countdown' ? prefs.countdown * 60 : mode === 'pomodoro' ? phaseTarget(phase) : 0
  const display = mode === 'stopwatch' ? elapsed : Math.max(0, target - elapsed)

  // fim de contagem
  useEffect(() => {
    if (!running || mode === 'stopwatch' || elapsed < target) return
    if (prefs.sound) beep()
    if (mode === 'countdown') {
      pause()
      return
    }
    advancePhase(true)
  })

  const start = () => {
    startRef.current = Date.now()
    setRunning(true)
  }
  const pause = () => {
    setAccum(elapsed)
    startRef.current = null
    setRunning(false)
  }
  const resetClock = () => {
    setAccum(0)
    startRef.current = running ? Date.now() : null
  }

  const advancePhase = (keepRunning: boolean) => {
    if (phase === 'study') {
      setStudiedPomodoro((s) => s + Math.min(elapsed, target))
      setPhase(round % prefs.pomodoroRounds === 0 ? 'long' : 'short')
    } else {
      setPhase('study')
      if (phase === 'long') setRound(1)
      else setRound((r) => r + 1)
    }
    setAccum(0)
    startRef.current = keepRunning ? Date.now() : null
    setRunning(keepRunning)
  }

  const studiedSeconds = () => {
    if (mode === 'pomodoro') return Math.round(studiedPomodoro + (phase === 'study' ? elapsed : 0))
    return Math.round(Math.min(elapsed, mode === 'countdown' ? target : Infinity))
  }

  const resetAll = () => {
    setRunning(false)
    setAccum(0)
    startRef.current = null
    setPhase('study')
    setRound(1)
    setStudiedPomodoro(0)
  }

  const finish = () => {
    const seconds = studiedSeconds()
    resetAll()
    rain.stop()
    closeTimer()
    if (seconds >= 60) openStudy({ duration: seconds, subjectId: subjectId || undefined, topicId: topicId || undefined, categoryId: timer?.categoryId })
  }

  const close = () => {
    if (studiedSeconds() >= 60 && !window.confirm('Descartar o tempo em andamento?')) return
    resetAll()
    rain.stop()
    closeTimer()
  }

  const switchMode = (m: Mode) => {
    if (m === mode) return
    if (studiedSeconds() >= 60 && !window.confirm('Trocar de modo zera o relógio atual. Continuar?')) return
    resetAll()
    setMode(m)
  }

  if (!timer) return null

  const subject = subjects.find((s) => s.id === subjectId)

  if (minimized) {
    return (
      <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 shadow-xl lg:left-[calc(50%+8rem)]">
        {subject && <span className="h-2.5 w-2.5 rounded-full" style={{ background: subject.color }} />}
        <span className="text-lg font-semibold tabular">{fmtClock(display)}</span>
        <button onClick={running ? pause : start} className="text-brand-600" aria-label={running ? 'Pausar' : 'Iniciar'}>
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button onClick={finish} className="text-muted hover:text-ink" aria-label="Finalizar">
          <Square size={16} />
        </button>
        <button onClick={() => setMinimized(false)} className="text-muted hover:text-ink" aria-label="Expandir">
          <Maximize2 size={16} />
        </button>
      </div>
    )
  }

  const progress = target ? Math.min(100, (elapsed / target) * 100) : running ? 100 : 0

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#1b1410]/[0.97] text-white backdrop-blur">
      <RainWindowArt className="pointer-events-none absolute left-8 top-20 hidden w-72 opacity-90 lg:block" />
      <LampArt className="pointer-events-none absolute bottom-10 right-12 hidden w-44 lg:block" />
      <div className="relative flex items-center justify-end gap-1 p-4">
        <button
          onClick={rain.toggle}
          className={clsx('mr-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition', rain.on ? 'border-brand-400 bg-brand-600/40 text-white' : 'border-white/15 text-white/60 hover:text-white')}
          title="Som de chuva ambiente"
        >
          <CloudRain size={14} /> {rain.on ? 'Chuva ligada' : 'Chuva'}
        </button>
        <button onClick={() => setShowPrefs((v) => !v)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Configurações">
          <Settings size={20} />
        </button>
        <button onClick={() => setMinimized(true)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Minimizar">
          <Minimize2 size={20} />
        </button>
        <button onClick={close} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Fechar">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <Logo className="text-white" />

        <div className="flex flex-wrap justify-center gap-2">
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setTopicId('')
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white [&>option]:text-black"
          >
            <option value="">Disciplina (opcional)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {subjectId && (
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="max-w-72 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white [&>option]:text-black"
            >
              <option value="">Tópico (opcional)</option>
              {topicsOf(subjectId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="w-full max-w-xl">
          <div className="mb-1 flex justify-end text-xs text-white/50 tabular">
            {target > 0 && `${fmtClock(Math.min(elapsed, target)).slice(0, 5)} / ${fmtClock(target).slice(0, 5)}`}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx('h-full rounded-full transition-all', phase === 'study' ? 'bg-brand-400' : 'bg-ok')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 md:flex-row">
          <div className="font-display text-7xl font-bold tracking-tight tabular sm:text-8xl md:text-9xl">{fmtClock(display)}</div>
          <div className="flex gap-4 text-sm font-semibold tracking-widest md:flex-col md:gap-2">
            {(
              [
                ['stopwatch', 'CRONÔMETRO'],
                ['countdown', 'TIMER'],
                ['pomodoro', 'POMODORO'],
              ] as const
            ).map(([m, label]) => (
              <button key={m} onClick={() => switchMode(m)} className={clsx('text-left transition', mode === m ? 'text-brand-300' : 'text-white/60 hover:text-white')}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={running ? pause : start}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-[#1b1410] transition hover:scale-105"
            aria-label={running ? 'Pausar' : 'Iniciar'}
          >
            {running ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
          <button
            onClick={finish}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 transition hover:scale-105"
            title="Finalizar e registrar"
          >
            <Square size={20} />
          </button>
          {mode === 'pomodoro' && (
            <button
              onClick={() => advancePhase(running)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
              title="Pular fase"
            >
              <SkipForward size={20} />
            </button>
          )}
          {mode !== 'pomodoro' && elapsed > 0 && (
            <button onClick={resetClock} className="text-sm text-white/60 hover:text-white">
              zerar
            </button>
          )}
        </div>

        {mode === 'pomodoro' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-white/70">
              Sessão {round} de {prefs.pomodoroRounds}
            </p>
            <div className="flex gap-2">
              {(
                [
                  ['study', 'Estudo'],
                  ['short', 'Pausa curta'],
                  ['long', 'Pausa longa'],
                ] as const
              ).map(([p, label]) => (
                <span
                  key={p}
                  className={clsx('rounded-full border px-4 py-1 text-xs font-semibold', phase === p ? 'border-brand-500 bg-brand-600' : 'border-white/20 text-white/60')}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-white/40">Ao finalizar, o tempo estudado abre no formulário de registro. ☕</p>
      </div>

      {showPrefs && (
        <div className="absolute right-4 top-16 w-72 rounded-xl border border-white/10 bg-[#30251d] p-4 text-sm shadow-2xl">
          <p className="mb-3 font-semibold">Configurações do relógio</p>
          {(
            [
              ['countdown', 'Timer (min)'],
              ['pomodoroStudy', 'Pomodoro – estudo (min)'],
              ['pomodoroShort', 'Pausa curta (min)'],
              ['pomodoroLong', 'Pausa longa (min)'],
              ['pomodoroRounds', 'Sessões até pausa longa'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="mb-2 flex items-center justify-between gap-2">
              <span className="text-white/70">{label}</span>
              <input
                type="number"
                min={1}
                value={prefs[k]}
                onChange={(e) => update((s) => ({ ...s, timerPrefs: { ...s.timerPrefs, [k]: Math.max(1, Number(e.target.value)) } }))}
                className="w-16 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-right"
              />
            </label>
          ))}
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={prefs.sound} onChange={(e) => update((s) => ({ ...s, timerPrefs: { ...s.timerPrefs, sound: e.target.checked } }))} />
            <span className="text-white/70">Som ao terminar</span>
          </label>
        </div>
      )}
    </div>
  )
}
