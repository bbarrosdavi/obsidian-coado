import raw from './import-petrobras.json'
import { emptyState } from '@coado/shared'
import type { AppState, Planning, Study, Subject, Topic } from '../lib/types'
import { addDays, SUBJECT_COLORS, uid } from '../lib/utils'

export { emptyState }

const CATEGORY_BY_CODE: Record<number, string> = { 1: 'teoria', 2: 'revisao', 3: 'questoes' }

/** Plano de exemplo (Petrobrás) com disciplinas, tópicos, histórico e ciclo */
export const seededState = (): AppState => {
  const state = emptyState()
  const planId = uid()
  state.plans.push({
    id: planId,
    ...raw.plan,
    weeklyGoal: { minutes: 600, questions: 100 },
    createdAt: '2026-04-30T00:00:00.000Z',
  })
  state.activePlanId = planId

  const subjectIds = new Map<number, string>()
  const topicIds = new Map<number, string>()
  raw.subjects.forEach((s, i) => {
    const id = uid()
    subjectIds.set(s.id, id)
    state.subjects.push({ id, planId, name: s.name, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], order: i } satisfies Subject)
    for (const t of s.topics) {
      const tid = uid()
      topicIds.set(t.id, tid)
      state.topics.push({
        id: tid,
        subjectId: id,
        name: t.name,
        order: t.order,
        finished: t.finished,
        links: [],
      } satisfies Topic)
    }
  })

  for (const s of raw.studies) {
    state.studies.push({
      id: uid(),
      planId,
      subjectId: subjectIds.get(s.subjectId)!,
      topicId: topicIds.get(s.topicId),
      categoryId: CATEGORY_BY_CODE[s.category] ?? 'teoria',
      date: s.date,
      time: s.time,
      duration: s.duration,
      material: s.material,
      hits: s.hit,
      misses: s.miss,
      pages: s.pages.map(([start, end]) => ({ start, end })),
      videos: [],
      comment: s.comment,
      countInPlanning: s.countInPlanning,
      createdAt: `${s.date}T${s.time}:00`,
    } satisfies Study)
  }

  const firstStudy = [...state.studies].sort((a, b) => a.date.localeCompare(b.date))[0]?.date
  const planning: Planning = {
    planId,
    type: 'cycle',
    completedCycles: 0,
    cycleStartedAt: firstStudy ? addDays(firstStudy, 0) : '2026-04-20',
    config: {
      weeklyMinutes: raw.cycleOptions.weeklyMinutes,
      days: [true, true, true, true, true, true, true],
      minSession: raw.cycleOptions.min,
      maxSession: raw.cycleOptions.max,
      subjects: raw.subjects.map((s) => ({ subjectId: subjectIds.get(s.id)!, importance: 1, knowledge: 3 })),
    },
    cycle: raw.cycle.map((sid) => ({ id: uid(), subjectId: subjectIds.get(sid)!, duration: raw.cycleDuration })),
  }
  state.plannings[planId] = planning
  return state
}
