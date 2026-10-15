import { describe, expect, it } from 'vitest'
import { emptyState } from './defaults'
import { SyncRequestSchema } from './schemas'
import { diffState, sanitizeState } from './sync'
import type { AppState, Plan, Study, Subject, Topic } from './types'

const plan = (id: string): Plan => ({ id, name: `Plano ${id}`, weeklyGoal: { minutes: 0, questions: 0 }, createdAt: '2026-01-01T00:00:00.000Z' })
const subject = (id: string, planId: string): Subject => ({ id, planId, name: id, color: '#fff', order: 0 })
const topic = (id: string, subjectId: string): Topic => ({ id, subjectId, name: id, order: 0, finished: false, links: [] })
const study = (id: string, planId: string, subjectId: string, topicId?: string): Study => ({
  id,
  planId,
  subjectId,
  topicId,
  categoryId: 'teoria',
  date: '2026-02-01',
  duration: 600,
  material: '',
  hits: 1,
  misses: 0,
  pages: [],
  videos: [],
  comment: '',
  countInPlanning: true,
  createdAt: '2026-02-01T10:00:00.000Z',
})

const base = (): AppState => ({
  ...emptyState(),
  plans: [plan('p1')],
  activePlanId: 'p1',
  subjects: [subject('s1', 'p1')],
  topics: [topic('t1', 's1')],
  studies: [study('e1', 'p1', 's1', 't1')],
})

describe('diffState', () => {
  it('não envia nada quando o estado não mudou', () => {
    const s = base()
    expect(diffState(s, s)).toBeNull()
    expect(diffState(s, { ...s })).toBeNull()
  })

  it('ignora objetos recriados com o mesmo conteúdo', () => {
    const s = base()
    const next = { ...s, topics: s.topics.map((t) => ({ ...t })) }
    expect(diffState(s, next)).toBeNull()
  })

  it('detecta inclusões, alterações e remoções por coleção', () => {
    const s = base()
    const next: AppState = {
      ...s,
      plans: [...s.plans, plan('p2')],
      subjects: [{ ...s.subjects[0], name: 'Português' }],
      studies: [],
    }
    const req = diffState(s, next)!
    expect(req.upserts?.plans?.map((p) => p.id)).toEqual(['p2'])
    expect(req.upserts?.subjects?.[0].name).toBe('Português')
    expect(req.deletes?.studies).toEqual(['e1'])
    expect(req.upserts?.topics).toBeUndefined()
    expect(req.settings).toBeUndefined()
  })

  it('trata planejamentos como registro por plano', () => {
    const s = base()
    const planning = {
      planId: 'p1',
      type: 'cycle' as const,
      config: { weeklyMinutes: 600, days: Array(7).fill(true), minSession: 30, maxSession: 90, subjects: [] },
      cycle: [],
      completedCycles: 0,
      cycleStartedAt: '2026-02-01',
    }
    const withPlanning = { ...s, plannings: { p1: planning } }
    expect(diffState(s, withPlanning)?.upserts?.plannings).toEqual([planning])
    expect(diffState(withPlanning, s)?.deletes?.plannings).toEqual(['p1'])
  })

  it('envia só as preferências alteradas', () => {
    const s = base()
    const req = diffState(s, { ...s, theme: 'dark', note: 'oi', timerPrefs: { ...s.timerPrefs } })
    expect(req).toEqual({ settings: { theme: 'dark', note: 'oi' } })
  })

  it('gera lotes válidos para a api', () => {
    const s = base()
    const req = diffState(emptyState(), s)!
    expect(SyncRequestSchema.safeParse(req).success).toBe(true)
  })
})

describe('sanitizeState', () => {
  it('remove referências quebradas e ids repetidos', () => {
    const s: AppState = {
      ...base(),
      activePlanId: 'sumiu',
      subjects: [subject('s1', 'p1'), subject('s2', 'sumiu')],
      topics: [topic('t1', 's1'), topic('t2', 's2')],
      studies: [study('e1', 'p1', 's1', 'tX'), study('e2', 'p1', 's2'), study('e1', 'p1', 's1')],
      reviews: [
        { id: 'r1', planId: 'p1', studyId: 'e1', subjectId: 's1', dueDate: '2026-02-02', interval: 1, status: 'pending' },
        { id: 'r2', planId: 'p1', studyId: 'e2', subjectId: 's1', dueDate: '2026-02-02', interval: 1, status: 'pending' },
      ],
    }
    const out = sanitizeState(s)
    expect(out.activePlanId).toBe('p1')
    expect(out.subjects.map((x) => x.id)).toEqual(['s1'])
    expect(out.topics.map((x) => x.id)).toEqual(['t1'])
    expect(out.studies.map((x) => x.id)).toEqual(['e1'])
    expect(out.studies[0].topicId).toBeUndefined()
    expect(out.reviews.map((x) => x.id)).toEqual(['r1'])
  })
})
