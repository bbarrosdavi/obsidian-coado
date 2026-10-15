import type { Plan, Planning, Study, Subject, WatchSnapshot } from '@coado/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, DB_URL, devLogin, setup, type TestCtx } from './helpers'

const plan: Plan = { id: 'p1', name: 'Petrobras', examDate: '2026-12-06', weeklyGoal: { minutes: 600, questions: 100 }, createdAt: '2026-04-30T00:00:00.000Z' }
const subjects: Subject[] = [
  { id: 's1', planId: 'p1', name: 'Cálculo', color: '#c08f5d', order: 0 },
  { id: 's2', planId: 'p1', name: 'Física', color: '#b8cfc6', order: 1 },
  { id: 's3', planId: 'p1', name: 'Arquivada', color: '#ccc', order: 2, archived: true },
]
const planning: Planning = {
  planId: 'p1',
  type: 'cycle',
  config: { weeklyMinutes: 600, days: [true, true, true, true, true, false, false], minSession: 30, maxSession: 90, subjects: [] },
  cycle: [
    { id: 'c1', subjectId: 's1', duration: 60 },
    { id: 'c2', subjectId: 's2', duration: 45 },
  ],
  completedCycles: 1,
  cycleStartedAt: '2026-05-01',
}
const study = (id: string, date: string, duration: number): Study => ({
  id,
  planId: 'p1',
  subjectId: 's1',
  categoryId: 'teoria',
  date,
  time: '08:30',
  duration,
  material: 'Livro',
  hits: 8,
  misses: 2,
  pages: [],
  videos: [],
  comment: '',
  countInPlanning: true,
  createdAt: `${date}T08:30:00.000Z`,
})

describe.skipIf(!DB_URL)('relógio', () => {
  let ctx: TestCtx
  let ana: ReturnType<typeof client>
  let token = ''

  const watch = () => client(ctx.app)
  const bearer = (t = token) => ({ headers: { authorization: `Bearer ${t}` } })

  beforeAll(async () => {
    ctx = await setup()
    ana = client(ctx.app, await devLogin(ctx.app, 'ana@coado.test', 'Ana'))
    const seed = await ana.post('/api/sync', {
      settings: { activePlanId: 'p1' },
      upserts: {
        plans: [plan],
        subjects,
        plannings: [planning],
        // um antes do ciclo (só conta na constância) e um dentro dele
        studies: [study('old', '2026-04-20', 1800), study('st1', '2026-05-01', 3600)],
        reviews: [{ id: 'r1', planId: 'p1', studyId: 'st1', subjectId: 's1', dueDate: '2026-05-02', interval: 1, status: 'pending' }],
      },
    })
    expect(seed.statusCode).toBe(200)
  })
  afterAll(() => ctx?.close())

  it('gera o código no navegador e o relógio o troca por um token', async () => {
    const res = await ana.post('/api/watch/pair-code')
    expect(res.statusCode).toBe(200)
    const { code, expiresAt } = res.json()
    expect(code).toMatch(/^\d{6}$/)
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now())

    const pair = await watch().post('/api/watch/pair', { code, device: 'TicWatch Pro 5' })
    expect(pair.statusCode).toBe(201)
    expect(pair.json()).toMatchObject({ me: { name: 'Ana', email: 'ana@coado.test' } })
    token = pair.json().token
    expect(token).toMatch(/^[\w-]{40,}$/)

    // o código vale uma vez só
    const again = await watch().post('/api/watch/pair', { code, device: 'Outro' })
    expect(again.statusCode).toBe(400)
    expect(again.json().error).toBe('pair_code')

    // o token entra como sessão da conta e aparece na lista do perfil
    const me = await ctx.app.inject({ method: 'GET', url: '/api/me', ...bearer() })
    expect(me.statusCode).toBe(200)
    expect(me.json().email).toBe('ana@coado.test')
    const sessions = (await ana.get('/api/me/sessions')).json()
    expect(sessions.map((s: { userAgent: string }) => s.userAgent)).toContain('Coado Watch (TicWatch Pro 5)')
  })

  it('recusa código errado, malformado e pedidos de código pelo próprio relógio', async () => {
    expect((await watch().post('/api/watch/pair', { code: '000000' })).statusCode).toBe(400)
    const bad = await watch().post('/api/watch/pair', { code: 'abc' })
    expect(bad.statusCode).toBe(400)
    expect(bad.json().error).toBe('validation')
    const fromWatch = await ctx.app.inject({ method: 'POST', url: '/api/watch/pair-code', headers: { 'x-coado-request': '1', ...bearer().headers } })
    expect(fromWatch.statusCode).toBe(403)
  })

  it('entrega o recorte da conta: plano ativo, disciplinas, ciclo e os estudos do ciclo', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/watch/snapshot?today=2026-05-03', ...bearer() })
    expect(res.statusCode).toBe(200)
    const snap: WatchSnapshot = res.json()
    expect(snap.today).toBe('2026-05-03')
    expect(snap.plan).toEqual({ id: 'p1', name: 'Petrobras', examDate: '2026-12-06', weeklyGoal: { minutes: 600, questions: 100 } })
    expect(snap.subjects.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(snap.categories.map((c) => c.id)).toEqual(['teoria', 'revisao', 'questoes'])
    expect(snap.planning).toMatchObject({ type: 'cycle', cycleStartedAt: '2026-05-01', completedCycles: 1 })
    expect(snap.planning?.cycle.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(snap.studies).toEqual([
      { id: 'st1', subjectId: 's1', categoryId: 'teoria', date: '2026-05-01', time: '08:30', duration: 3600, hits: 8, misses: 2, countInPlanning: true },
    ])
    expect(snap.studiedDates).toEqual(['2026-04-20', '2026-05-01'])
    expect(snap.reviewsDue).toBe(1)
    expect(snap.timerPrefs.pomodoroStudy).toBe(25)
    expect(snap.reviewIntervals).toEqual([1, 7, 30, 60, 120])
  })

  it('o relógio registra estudos pelo /sync e eles chegam ao navegador', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-coado-request': '1', ...bearer().headers },
      payload: { upserts: { studies: [study('watch1', '2026-05-03', 1500)] } },
    })
    expect(res.statusCode).toBe(200)
    const snap: WatchSnapshot = (await ctx.app.inject({ method: 'GET', url: '/api/watch/snapshot?today=2026-05-03', ...bearer() })).json()
    expect(snap.studies.map((s) => s.id)).toEqual(['st1', 'watch1'])
    const state = (await ana.get('/api/state')).json()
    expect(state.studies.map((s: Study) => s.id).sort()).toEqual(['old', 'st1', 'watch1'])
  })

  it('modo universidade: o recorte traz o tipo do plano, as avaliações pendentes e o vínculo do estudo', async () => {
    const now = new Date().toISOString()
    const aval = (id: string, date: string, done = false) => ({ id, planId: 'p1', subjectId: 's1', name: id.toUpperCase(), kind: 'prova', date, done, notes: '', createdAt: now })
    const up = await ana.post('/api/sync', {
      upserts: { plans: [{ ...plan, kind: 'universidade' }], assessments: [aval('p2', '2026-06-10'), aval('feita', '2026-04-30', true), aval('lista', '2026-05-01')] },
    })
    expect(up.statusCode).toBe(200)
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-coado-request': '1', ...bearer().headers },
      payload: { upserts: { studies: [{ ...study('watch2', '2026-05-03', 900), assessmentId: 'p2' }] } },
    })
    expect(res.statusCode).toBe(200)
    const snap: WatchSnapshot = (await ctx.app.inject({ method: 'GET', url: '/api/watch/snapshot?today=2026-05-03', ...bearer() })).json()
    expect(snap.plan?.kind).toBe('universidade')
    // a feita fica de fora; a atrasada vem antes
    expect(snap.assessments.map((a) => a.id)).toEqual(['lista', 'p2'])
    expect(snap.assessments[0]).toEqual({ id: 'lista', subjectId: 's1', name: 'LISTA', kind: 'prova', date: '2026-05-01' })
    expect(snap.studies.find((s) => s.id === 'watch2')?.assessmentId).toBe('p2')
  })

  it('sem plano ativo o recorte vem vazio', async () => {
    const bia = client(ctx.app, await devLogin(ctx.app, 'bia@coado.test', 'Bia'))
    const { code } = (await bia.post('/api/watch/pair-code')).json()
    const t = (await watch().post('/api/watch/pair', { code })).json().token
    const snap: WatchSnapshot = (await ctx.app.inject({ method: 'GET', url: '/api/watch/snapshot', ...bearer(t) })).json()
    expect(snap.plan).toBeNull()
    expect(snap.subjects).toEqual([])
    expect(snap.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('encerrar a sessão do relógio no perfil invalida o token', async () => {
    const sessions = (await ana.get('/api/me/sessions')).json()
    const device = sessions.find((s: { userAgent: string | null }) => s.userAgent?.startsWith('Coado Watch'))
    expect((await ana.del(`/api/me/sessions/${device.id}`)).statusCode).toBe(204)
    const me = await ctx.app.inject({ method: 'GET', url: '/api/me', ...bearer() })
    expect(me.statusCode).toBe(401)
    // a recusa de um Bearer não mexe no cookie de ninguém
    expect(me.headers['set-cookie']).toBeUndefined()
  })
})
