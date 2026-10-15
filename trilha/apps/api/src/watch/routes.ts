import {
  DEFAULT_REVIEW_INTERVALS,
  DEFAULT_TIMER_PREFS,
  type AssessmentKind,
  type CycleItem,
  type DateStr,
  type PairResponse,
  type TimerPrefs,
  type WatchSnapshot,
} from '@coado/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createSession } from '../auth/sessions'
import { findUser } from '../auth/users'
import { ENTITIES } from '../data/entities'
import type { Deps } from '../deps'
import { HttpError, unauthorized } from '../errors'
import { consumePairCode, createPairCode } from './pairing'

/*
 * O relógio (apps/watch). Ele não carrega o estado inteiro da conta: pede um recorte com o que
 * precisa para montar a próxima sessão do ciclo e contabilizar o dia, e registra os estudos pelo
 * /sync comum, autenticado pelo token de aparelho (Bearer).
 */

const PairBody = z.object({
  code: z.string().regex(/^\d{6}$/, 'o código tem 6 dígitos'),
  /** modelo do relógio, para a lista de sessões do perfil */
  device: z.string().trim().min(1).max(120).default('Relógio'),
})

const SnapshotQuery = z.object({
  /** a data local do relógio (o servidor pode estar em outro fuso) */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseDate = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (s: DateStr, n: number) => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
/** domingo da semana (a meta semanal da home conta de domingo a sábado) */
const startOfWeek = (s: DateStr) => addDays(s, -parseDate(s).getDay())

/** Rota pública: o relógio ainda não tem sessão quando troca o código */
export async function watchPairRoutes(app: FastifyInstance, { config, pool }: Deps) {
  app.post('/watch/pair', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = PairBody.parse(request.body ?? {})
    const userId = await consumePairCode(pool, body.code)
    if (!userId) throw new HttpError(400, 'pair_code', 'Código inválido ou vencido. Gere outro em Configurações → Relógio.')
    const user = await findUser(pool, userId)
    if (!user) throw unauthorized()
    const token = await createSession(pool, config, userId, `Coado Watch (${body.device})`, 'device')
    const res: PairResponse = {
      token,
      me: { name: user.name, email: user.email },
      expiresAt: new Date(Date.now() + config.deviceTtlMs).toISOString(),
    }
    return reply.code(201).send(res)
  })
}

export async function watchRoutes(app: FastifyInstance, { pool }: Deps) {
  app.post('/watch/pair-code', async (request) => {
    // só o navegador emite códigos: um token de aparelho não pode parear outros aparelhos
    if (request.sessionKind !== 'web') throw new HttpError(403, 'forbidden', 'Gere o código pelo navegador, em Configurações → Relógio.')
    return createPairCode(pool, request.user.id)
  })

  app.get('/watch/snapshot', async (request): Promise<WatchSnapshot> => {
    const { today = toDateStr(new Date()) } = SnapshotQuery.parse(request.query ?? {})
    const userId = request.user.id

    const settings = (
      await pool.query<{ active_plan_id: string | null; timer_prefs: TimerPrefs; review_intervals: number[] }>(
        'select active_plan_id, timer_prefs, review_intervals from user_settings where user_id = $1',
        [userId],
      )
    ).rows[0]
    const categories = (
      await pool.query<{ id: string; name: string }>(
        `select id, name from categories where user_id = $1 order by ${ENTITIES.categories.orderBy}`,
        [userId],
      )
    ).rows

    const base = {
      serverTime: new Date().toISOString(),
      today,
      categories,
      timerPrefs: settings?.timer_prefs ?? { ...DEFAULT_TIMER_PREFS },
      reviewIntervals: settings?.review_intervals ?? [...DEFAULT_REVIEW_INTERVALS],
    }

    const planId = settings?.active_plan_id
    const plan = planId
      ? (
          await pool.query<{ id: string; name: string; exam_date: string | null; kind: string | null; weekly_goal_minutes: number; weekly_goal_questions: number }>(
            'select id, name, exam_date, kind, weekly_goal_minutes, weekly_goal_questions from plans where user_id = $1 and id = $2',
            [userId, planId],
          )
        ).rows[0]
      : undefined
    if (!plan) return { ...base, plan: null, subjects: [], planning: null, studies: [], studiedDates: [], reviewsDue: 0, assessments: [] }

    const subjects = (
      await pool.query<{ id: string; name: string; color: string }>(
        'select id, name, color from subjects where user_id = $1 and plan_id = $2 and not archived order by position, id',
        [userId, plan.id],
      )
    ).rows

    const planningRow = (
      await pool.query<{ type: 'cycle' | 'weekly'; cycle: CycleItem[]; cycle_started_at: string; completed_cycles: number }>(
        'select type, cycle, cycle_started_at, completed_cycles from plannings where user_id = $1 and plan_id = $2',
        [userId, plan.id],
      )
    ).rows[0]
    const planning = planningRow
      ? { type: planningRow.type, cycle: planningRow.cycle, cycleStartedAt: planningRow.cycle_started_at, completedCycles: planningRow.completed_cycles }
      : null

    // o ciclo atual e a semana atual: o que o relógio soma para progresso e metas
    const week = startOfWeek(today)
    const since = planning && planning.cycleStartedAt < week ? planning.cycleStartedAt : week
    const studies = (
      await pool.query<{
        id: string
        subject_id: string
        topic_id: string | null
        assessment_id: string | null
        category_id: string
        date: string
        time: string | null
        duration: number
        hits: number
        misses: number
        count_in_planning: boolean
      }>(
        `select id, subject_id, topic_id, assessment_id, category_id, date, time, duration, hits, misses, count_in_planning
           from studies where user_id = $1 and plan_id = $2 and date >= $3
          order by date, time nulls first, created_at, id`,
        [userId, plan.id, since],
      )
    ).rows.map((r) => ({
      id: r.id,
      subjectId: r.subject_id,
      ...(r.topic_id ? { topicId: r.topic_id } : {}),
      ...(r.assessment_id ? { assessmentId: r.assessment_id } : {}),
      categoryId: r.category_id,
      date: r.date,
      ...(r.time ? { time: r.time } : {}),
      duration: r.duration,
      hits: r.hits,
      misses: r.misses,
      countInPlanning: r.count_in_planning,
    }))

    const studiedDates = (
      await pool.query<{ date: string }>('select distinct date from studies where user_id = $1 and plan_id = $2 order by date', [
        userId,
        plan.id,
      ])
    ).rows.map((r) => r.date)

    const reviewsDue = (
      await pool.query<{ n: number }>(
        `select count(*)::int as n from reviews where user_id = $1 and plan_id = $2 and status = 'pending' and due_date <= $3`,
        [userId, plan.id, today],
      )
    ).rows[0].n

    // pendentes: as atrasadas primeiro, depois as próximas; o relógio mostra poucas
    const assessments = (
      await pool.query<{ id: string; subject_id: string; name: string; kind: AssessmentKind; date: string; time: string | null }>(
        `select id, subject_id, name, kind, date, time from assessments
          where user_id = $1 and plan_id = $2 and not done
          order by date, time nulls last, id limit 60`,
        [userId, plan.id],
      )
    ).rows.map((r) => ({ id: r.id, subjectId: r.subject_id, name: r.name, kind: r.kind, date: r.date, ...(r.time ? { time: r.time } : {}) }))

    return {
      ...base,
      plan: {
        id: plan.id,
        name: plan.name,
        ...(plan.exam_date ? { examDate: plan.exam_date } : {}),
        ...(plan.kind === 'universidade' ? { kind: 'universidade' as const } : {}),
        weeklyGoal: { minutes: plan.weekly_goal_minutes, questions: plan.weekly_goal_questions },
      },
      subjects,
      planning,
      studies,
      studiedDates,
      reviewsDue,
      assessments,
    }
  })
}
