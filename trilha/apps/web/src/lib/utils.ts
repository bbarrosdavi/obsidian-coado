import type { CycleItem, DateStr, Planning, PlanningConfig, Study, Subject } from './types'

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 16)

// ---------- datas ----------

const pad = (n: number) => String(n).padStart(2, '0')

export const toDateStr = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = (): DateStr => toDateStr(new Date())

export const parseDate = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (s: DateStr, n: number): DateStr => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export const diffDays = (a: DateStr, b: DateStr) =>
  Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000)

/** Domingo da semana da data */
export const startOfWeek = (s: DateStr): DateStr => addDays(s, -parseDate(s).getDay())

export const startOfMonth = (s: DateStr): DateStr => s.slice(0, 8) + '01'

export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
export const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export const weekdayShort = (s: DateStr) => WEEKDAYS[parseDate(s).getDay()]
export const monthShort = (s: DateStr) => MONTHS[parseDate(s).getMonth()]
/** 11/10 */
export const fmtDayMonth = (s: DateStr) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
/** 11/10/2026 */
export const fmtDate = (s: DateStr) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`

export const dateRange = (from: DateStr, to: DateStr): DateStr[] => {
  const out: DateStr[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ---------- duração ----------

/** 5400 → "1h30min"; 0 → "0min" */
export const fmtDuration = (seconds: number) => {
  const totalMin = Math.round(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  return `${h}h${pad(m)}min`
}

/** minutos → "1h30min" */
export const fmtMinutes = (min: number) => fmtDuration(min * 60)

/** 5400 → "01:30:00" */
export const fmtClock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** "01:30:00" | "1:30" | "90" → segundos */
export const parseClock = (v: string) => {
  const parts = v.trim().split(':').map((p) => Number(p) || 0)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  return parts[0] * 60
}

export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

// ---------- agregações de estudos ----------

export const studyPages = (s: Study) => s.pages.reduce((a, p) => a + Math.max(0, p.end - p.start), 0)
export const studyVideoSeconds = (s: Study) => s.videos.reduce((a, v) => a + Math.max(0, v.end - v.start), 0)

export interface Totals {
  duration: number
  hits: number
  misses: number
  questions: number
  performance: number
  pages: number
  /** duração somada dos estudos que tiveram páginas, para páginas/hora */
  pagesDuration: number
  pagesPerHour: number
  videoSeconds: number
  days: number
}

export const totals = (studies: Study[]): Totals => {
  let duration = 0,
    hits = 0,
    misses = 0,
    pages = 0,
    pagesDuration = 0,
    videoSeconds = 0
  const days = new Set<string>()
  for (const s of studies) {
    duration += s.duration
    hits += s.hits
    misses += s.misses
    const p = studyPages(s)
    if (p > 0) {
      pages += p
      pagesDuration += s.duration
    }
    videoSeconds += studyVideoSeconds(s)
    days.add(s.date)
  }
  const questions = hits + misses
  return {
    duration,
    hits,
    misses,
    questions,
    performance: pct(hits, questions),
    pages,
    pagesDuration,
    pagesPerHour: pagesDuration > 0 ? Math.round((pages / (pagesDuration / 3600)) * 10) / 10 : 0,
    videoSeconds,
    days: days.size,
  }
}

export const inRange = (s: Study, from?: DateStr, to?: DateStr) => (!from || s.date >= from) && (!to || s.date <= to)

// ---------- constância ----------

export interface Constancy {
  studiedDays: Set<DateStr>
  /** dias consecutivos até hoje (ou ontem, se hoje ainda não estudou) */
  current: number
  record: number
  /** dias desde o último estudo (0 = estudou hoje) */
  daysSinceLast: number | null
}

export const constancy = (studies: Study[], ref: DateStr = today()): Constancy => {
  const studiedDays = new Set(studies.map((s) => s.date))
  const sorted = [...studiedDays].sort()
  let record = 0,
    run = 0,
    prev: DateStr | null = null
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1
    record = Math.max(record, run)
    prev = d
  }
  let current = 0
  let cursor = studiedDays.has(ref) ? ref : addDays(ref, -1)
  while (studiedDays.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }
  const last = sorted.filter((d) => d <= ref).pop()
  return { studiedDays, current, record, daysSinceLast: last ? diffDays(ref, last) : null }
}

// ---------- planejamento ----------

/** Peso relativo de uma disciplina: mais importância e menos conhecimento → mais tempo */
export const subjectWeight = (importance: number, knowledge: number) => importance * (6 - knowledge)

const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step)

/**
 * Gera a sequência do ciclo a partir das relevâncias.
 * Tempo total do ciclo = horas semanais. Cada disciplina recebe uma fatia proporcional ao peso,
 * dividida em sessões entre min e max, intercaladas para não repetir a mesma disciplina em sequência.
 */
export const generateCycle = (cfg: PlanningConfig): CycleItem[] => {
  const subs = cfg.subjects.filter((s) => s.importance > 0)
  if (!subs.length) return []
  const weights = subs.map((s) => subjectWeight(s.importance, s.knowledge))
  const sum = weights.reduce((a, b) => a + b, 0)
  const total = Math.max(cfg.weeklyMinutes, cfg.minSession * subs.length)

  const queues = subs.map((s, i) => {
    const minutes = Math.max(cfg.minSession, roundTo((weights[i] / sum) * total, 15))
    const n = Math.max(1, Math.ceil(minutes / cfg.maxSession))
    const session = Math.min(cfg.maxSession, Math.max(cfg.minSession, roundTo(minutes / n, 15)))
    return { subjectId: s.subjectId, weight: weights[i], sessions: Array.from({ length: n }, () => session) }
  })

  const out: CycleItem[] = []
  let last: string | null = null
  while (queues.some((q) => q.sessions.length)) {
    const candidates = queues
      .filter((q) => q.sessions.length)
      .sort((a, b) => b.sessions.length - a.sessions.length || b.weight - a.weight)
    const pick = candidates.find((q) => q.subjectId !== last) ?? candidates[0]
    out.push({ id: uid(), subjectId: pick.subjectId, duration: pick.sessions.shift()! })
    last = pick.subjectId
  }
  return out
}

export interface CycleProgressItem extends CycleItem {
  /** segundos estudados atribuídos a este item */
  studied: number
  done: boolean
}

/**
 * Distribui o tempo estudado (desde o início do ciclo) pelos itens da sequência:
 * cada estudo preenche o primeiro item incompleto da mesma disciplina; o excedente vai para o último item dela.
 */
export const cycleProgress = (planning: Planning, studies: Study[]): CycleProgressItem[] => {
  const items: CycleProgressItem[] = planning.cycle.map((c) => ({ ...c, studied: 0, done: false }))
  const relevant = studies
    .filter((s) => s.countInPlanning && s.date >= planning.cycleStartedAt)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  for (const s of relevant) {
    let remaining = s.duration
    const own = items.filter((i) => i.subjectId === s.subjectId)
    if (!own.length) continue
    for (const it of own) {
      if (remaining <= 0) break
      const room = it.duration * 60 - it.studied
      if (room <= 0) continue
      const used = Math.min(room, remaining)
      it.studied += used
      remaining -= used
    }
    if (remaining > 0) own[own.length - 1].studied += remaining
  }
  for (const it of items) it.done = it.studied >= it.duration * 60
  return items
}

/** Distribui a sequência do ciclo pelos dias marcados (modo semanal) */
export const weeklySchedule = (planning: Planning) => {
  const days = planning.config.days.map((on, i) => ({ day: i, on }))
  const active = days.filter((d) => d.on)
  const buckets: { day: number; items: CycleItem[]; minutes: number }[] = days.map((d) => ({ day: d.day, items: [], minutes: 0 }))
  if (!active.length) return buckets
  const perDay = planning.config.weeklyMinutes / active.length
  let idx = 0
  for (const item of planning.cycle) {
    while (idx < active.length - 1 && buckets[active[idx].day].minutes + item.duration / 2 > perDay) idx++
    const b = buckets[active[idx].day]
    b.items.push(item)
    b.minutes += item.duration
  }
  return buckets
}

// ---------- cores ----------

export const SUBJECT_COLORS = [
  '#e7b7a3', '#d9c3a5', '#c9d3b3', '#b8cfc6', '#e8c6c0', '#dfd0b8', '#c6b9d3', '#a9c5c9',
  '#f0cfa8', '#c8b7a6', '#b7c9b1', '#e3b9b1', '#d6c4de', '#a8bfd4', '#e9d5a1', '#bcd2bd',
]

export const subjectColor = (subjects: Subject[], id: string) => subjects.find((s) => s.id === id)?.color ?? '#ccc'

export const clsx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** 1536 → "1,5 KB" */
export const fmtBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}
