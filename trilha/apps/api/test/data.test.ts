import { emptyState, type AppState, type Plan, type Study, type Subject, type Topic } from '@coado/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, DB_URL, devLogin, setup, type TestCtx } from './helpers'

const plan: Plan = {
  id: 'p1',
  name: 'Petrobras',
  org: 'Petrobras S.A.',
  examDate: '2026-12-06',
  weeklyGoal: { minutes: 600, questions: 100 },
  createdAt: '2026-04-30T00:00:00.000Z',
}
const subject: Subject = { id: 's1', planId: 'p1', name: 'Cálculo', color: '#c08f5d', order: 0 }
const topic: Topic = { id: 't1', subjectId: 's1', name: 'Limites', order: 1, finished: false, links: [{ title: 'aula', url: 'https://x.test' }] }
const study: Study = {
  id: 'st1',
  planId: 'p1',
  subjectId: 's1',
  topicId: 't1',
  categoryId: 'teoria',
  date: '2026-05-01',
  time: '08:30',
  duration: 3600,
  material: 'Livro',
  hits: 8,
  misses: 2,
  pages: [{ start: 1, end: 10 }],
  videos: [],
  comment: '',
  countInPlanning: true,
  createdAt: '2026-05-01T08:30:00.000Z',
}

describe.skipIf(!DB_URL)('sincronização', () => {
  let ctx: TestCtx
  let ana: ReturnType<typeof client>
  let bia: ReturnType<typeof client>

  beforeAll(async () => {
    ctx = await setup()
    ana = client(ctx.app, await devLogin(ctx.app, 'ana@coado.test', 'Ana'))
    bia = client(ctx.app, await devLogin(ctx.app, 'bia@coado.test', 'Bia'))
  })
  afterAll(() => ctx?.close())

  it('upserts aparecem no estado com datas e opcionais intactos', async () => {
    const res = await ana.post('/api/sync', {
      upserts: {
        plans: [plan],
        subjects: [subject],
        topics: [topic],
        studies: [study],
        reviews: [{ id: 'r1', planId: 'p1', studyId: 'st1', subjectId: 's1', topicId: 't1', dueDate: '2026-05-02', interval: 1, status: 'pending' }],
        plannings: [
          {
            planId: 'p1',
            type: 'cycle',
            config: { weeklyMinutes: 600, days: [true, true, true, true, true, false, false], minSession: 30, maxSession: 90, subjects: [{ subjectId: 's1', importance: 1, knowledge: 3 }] },
            cycle: [{ id: 'c1', subjectId: 's1', duration: 60 }],
            completedCycles: 0,
            cycleStartedAt: '2026-05-01',
          },
        ],
        exams: [{ id: 'e1', planId: 'p1', date: '2026-05-10', name: 'Simulado 1', style: 'multiple', board: 'Cesgranrio', timeSpent: 7200, rows: [{ subjectId: 's1', weight: 1, total: 10, hits: 7, misses: 3 }], comment: '' }],
        reminders: [{ id: 'm1', text: 'Comprar café', done: false, createdAt: '2026-05-01T10:00:00.000Z' }],
      },
      settings: { activePlanId: 'p1', theme: 'dark', note: 'oi', reviewIntervals: [1, 3, 7], timerPrefs: { pomodoroStudy: 50, pomodoroShort: 10, pomodoroLong: 20, pomodoroRounds: 3, countdown: 90, sound: false } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, syncedAt: expect.any(String) })

    const state: AppState = (await ana.get('/api/state')).json()
    expect(state.plans).toEqual([plan])
    expect(state.subjects).toEqual([subject])
    expect('archived' in state.subjects[0]).toBe(false)
    expect(state.topics).toEqual([topic])
    expect(state.studies).toEqual([study])
    expect(state.reviews[0]).toEqual({ id: 'r1', planId: 'p1', studyId: 'st1', subjectId: 's1', topicId: 't1', dueDate: '2026-05-02', interval: 1, status: 'pending' })
    expect(state.plannings.p1.cycleStartedAt).toBe('2026-05-01')
    expect(state.plannings.p1.config.days).toHaveLength(7)
    expect(state.exams[0].rows[0].hits).toBe(7)
    expect(state.reminders).toEqual([{ id: 'm1', text: 'Comprar café', done: false, createdAt: '2026-05-01T10:00:00.000Z' }])
    expect(state).toMatchObject({ activePlanId: 'p1', theme: 'dark', note: 'oi', reviewIntervals: [1, 3, 7] })
    expect(state.timerPrefs.pomodoroStudy).toBe(50)
  })

  it('atualiza linhas existentes e remove opcionais', async () => {
    const { org: _org, ...noOrg } = plan
    void _org
    await ana.post('/api/sync', { upserts: { plans: [{ ...noOrg, name: 'Petrobras 2026' }], subjects: [{ ...subject, archived: true }] } })
    const state: AppState = (await ana.get('/api/state')).json()
    expect(state.plans[0].name).toBe('Petrobras 2026')
    expect(state.plans[0].org).toBeUndefined()
    expect(state.subjects[0].archived).toBe(true)
  })

  it('apagar tópico limpa o topicId de estudos e revisões', async () => {
    await ana.post('/api/sync', { upserts: { studies: [{ ...study, topicId: undefined }] }, deletes: { topics: ['t1'] } })
    const state: AppState = (await ana.get('/api/state')).json()
    expect(state.topics).toEqual([])
    expect(state.studies[0].topicId).toBeUndefined()
    expect(state.reviews[0].topicId).toBeUndefined()
  })

  it('outra conta com os mesmos ids tem dados próprios', async () => {
    const res = await bia.post('/api/sync', { upserts: { plans: [{ ...plan, name: 'Plano da Bia' }] } })
    expect(res.statusCode).toBe(200)
    const anaState: AppState = (await ana.get('/api/state')).json()
    const biaState: AppState = (await bia.get('/api/state')).json()
    expect(anaState.plans[0].name).toBe('Petrobras 2026')
    expect(biaState.plans).toHaveLength(1)
    expect(biaState.plans[0].name).toBe('Plano da Bia')
    expect(biaState.studies).toEqual([])
  })

  it('não dá para apontar para dados de outra conta', async () => {
    const res = await bia.post('/api/sync', { upserts: { subjects: [{ ...subject, id: 's-bia', planId: 'p-so-da-ana' }] } })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('conflict')
    // a transação inteira foi desfeita
    expect(((await bia.get('/api/state')).json() as AppState).subjects).toEqual([])
  })

  it('apagar outra conta não tem efeito', async () => {
    await bia.post('/api/sync', { deletes: { plans: ['p1'] } })
    expect(((await ana.get('/api/state')).json() as AppState).plans).toHaveLength(1)
  })

  it('apagar plano leva tudo junto (cascata)', async () => {
    await ana.post('/api/sync', { deletes: { plans: ['p1'] } })
    const state: AppState = (await ana.get('/api/state')).json()
    expect(state.plans).toEqual([])
    expect(state.subjects).toEqual([])
    expect(state.studies).toEqual([])
    expect(state.reviews).toEqual([])
    expect(state.exams).toEqual([])
    expect(state.plannings).toEqual({})
    expect(state.reminders).toHaveLength(1)
  })

  it('valida o payload', async () => {
    const bad = await ana.post('/api/sync', { upserts: { plans: [{ ...plan, id: 'id com espaço' }] } })
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toMatchObject({ error: 'validation', details: expect.any(Array) })
    const badDate = await ana.post('/api/sync', { upserts: { studies: [{ ...study, date: '01/05/2026' }] } })
    expect(badDate.statusCode).toBe(400)
  })
})

describe.skipIf(!DB_URL)('importação (PUT /state)', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await setup()
  })
  afterAll(() => ctx?.close())

  it('substitui tudo e descarta referências quebradas', async () => {
    const api = client(ctx.app, await devLogin(ctx.app))
    await api.post('/api/sync', { upserts: { plans: [{ ...plan, id: 'velho' }] } })

    const backup: AppState = {
      ...emptyState(),
      plans: [plan],
      activePlanId: 'nao-existe',
      subjects: [subject, { ...subject, id: 'orfa', planId: 'sumiu' }],
      topics: [topic, { ...topic, id: 't-orfao', subjectId: 'orfa' }],
      studies: [{ ...study, topicId: 't-orfao' }, { ...study, id: 'st-orfao', subjectId: 'orfa' }],
      reviews: [{ id: 'r1', planId: 'p1', studyId: 'st-orfao', subjectId: 's1', dueDate: '2026-05-02', interval: 1, status: 'pending' }],
      theme: 'light',
    }
    const res = await api.put('/api/state', backup)
    expect(res.statusCode).toBe(200)
    const state: AppState = res.json()
    expect(state.plans.map((p) => p.id)).toEqual(['p1'])
    expect(state.activePlanId).toBe('p1')
    expect(state.subjects.map((s) => s.id)).toEqual(['s1'])
    expect(state.topics.map((t) => t.id)).toEqual(['t1'])
    expect(state.studies).toHaveLength(1)
    expect(state.studies[0].topicId).toBeUndefined()
    expect(state.reviews).toEqual([])
    expect(state.theme).toBe('light')
    expect(state.categories).toHaveLength(3)
  })

  it('recusa backup inválido', async () => {
    const api = client(ctx.app, await devLogin(ctx.app))
    const res = await api.put('/api/state', { plans: 'nada' })
    expect(res.statusCode).toBe(400)
  })
})

describe.skipIf(!DB_URL)('modo universidade: avaliações', () => {
  let ctx: TestCtx
  let ana: ReturnType<typeof client>
  const semestre: Plan = { ...plan, id: 'u1', name: 'UTFPR 2026/2', kind: 'universidade', examDate: undefined }
  const disc: Subject = { ...subject, id: 'u1s1', planId: 'u1', name: 'ELT75A Análise de Sistemas Lineares' }
  const prova = {
    id: 'av1', planId: 'u1', subjectId: 'u1s1', name: 'Prova 1', kind: 'prova' as const, date: '2026-10-13', time: '11:10',
    weight: '50%', grade: 7.5, maxGrade: 10, done: true, notes: '', createdAt: '2026-10-01T00:00:00.000Z',
  }
  const entrega = { ...prova, id: 'av2', name: 'Relatório 4', kind: 'trabalho' as const, date: '2026-10-14', time: undefined, weight: undefined, grade: undefined, maxGrade: undefined, done: false }
  const estudo: Study = { ...study, id: 'ust1', planId: 'u1', subjectId: 'u1s1', topicId: undefined, assessmentId: 'av1' }

  beforeAll(async () => {
    ctx = await setup()
    ana = client(ctx.app, await devLogin(ctx.app, 'ana-uni@coado.test', 'Ana'))
  })
  afterAll(() => ctx?.close())

  it('plano guarda o tipo e as avaliações voltam com os opcionais intactos', async () => {
    const res = await ana.post('/api/sync', { upserts: { plans: [semestre], subjects: [disc], assessments: [prova, entrega], studies: [estudo] } })
    expect(res.statusCode).toBe(200)
    const s = (await ana.get('/api/state')).json() as AppState
    expect(s.plans.find((p) => p.id === 'u1')?.kind).toBe('universidade')
    expect(s.assessments).toEqual([prova, { ...entrega, time: undefined, weight: undefined, grade: undefined, maxGrade: undefined }].map((a) => JSON.parse(JSON.stringify(a))))
    expect(s.studies.find((x) => x.id === 'ust1')?.assessmentId).toBe('av1')
  })

  it('plano antigo, sem tipo, continua concurso', async () => {
    await ana.post('/api/sync', { upserts: { plans: [{ ...plan, id: 'c9' }] } })
    const s = (await ana.get('/api/state')).json() as AppState
    expect(s.plans.find((p) => p.id === 'c9')?.kind).toBeUndefined()
  })

  it('apagar a avaliação solta o estudo sem apagá-lo', async () => {
    await ana.post('/api/sync', { deletes: { assessments: ['av1'] } })
    const s = (await ana.get('/api/state')).json() as AppState
    expect(s.assessments.map((a) => a.id)).toEqual(['av2'])
    const st = s.studies.find((x) => x.id === 'ust1')
    expect(st).toBeDefined()
    expect(st?.assessmentId).toBeUndefined()
  })

  it('apagar a disciplina leva as avaliações dela (cascata)', async () => {
    await ana.post('/api/sync', { deletes: { subjects: ['u1s1'] } })
    const s = (await ana.get('/api/state')).json() as AppState
    expect(s.assessments).toEqual([])
  })

  it('recusa tipo de avaliação desconhecido', async () => {
    const res = await ana.post('/api/sync', { upserts: { assessments: [{ ...entrega, id: 'av3', kind: 'simulado' }] } })
    expect(res.statusCode).toBe(400)
  })
})
