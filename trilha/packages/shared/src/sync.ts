import type { SyncRequest } from './schemas'
import type { AppState, ID } from './types'

/*
 * Protocolo de sincronização.
 *
 * O navegador mantém o AppState inteiro em memória (as ações continuam síncronas e instantâneas).
 * Periodicamente ele compara o último estado confirmado pelo servidor com o atual e envia só a
 * diferença: linhas novas/alteradas (upserts), ids removidos (deletes) e preferências mudadas.
 * O servidor aplica o lote numa transação; vale a última escrita por linha.
 */

/** Coleções em lista, na ordem pai → filho (é a ordem em que o servidor aplica os upserts) */
export const LIST_COLLECTIONS = ['categories', 'plans', 'subjects', 'topics', 'assessments', 'studies', 'reviews', 'exams', 'reminders'] as const
export type ListCollection = (typeof LIST_COLLECTIONS)[number]

export const SETTINGS_KEYS = ['activePlanId', 'theme', 'timerPrefs', 'reviewIntervals', 'note'] as const

type Upserts = NonNullable<SyncRequest['upserts']>
type Deletes = NonNullable<SyncRequest['deletes']>
type SettingsPatch = NonNullable<SyncRequest['settings']>

/** Igualdade estrutural barata: mesma referência ou mesmo JSON */
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

function diffList<T extends { id: ID }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]))
  const upserts: T[] = []
  for (const item of next) {
    const old = before.get(item.id)
    before.delete(item.id)
    if (!old || !same(old, item)) upserts.push(item)
  }
  return { upserts, deletes: [...before.keys()] }
}

/** Diferença entre dois estados; `null` quando não há nada a enviar */
export function diffState(prev: AppState, next: AppState): SyncRequest | null {
  if (prev === next) return null
  const upserts: Record<string, unknown[]> = {}
  const deletes: Record<string, ID[]> = {}

  for (const key of LIST_COLLECTIONS) {
    if (prev[key] === next[key]) continue
    const d = diffList<{ id: ID }>(prev[key], next[key])
    if (d.upserts.length) upserts[key] = d.upserts
    if (d.deletes.length) deletes[key] = d.deletes
  }

  if (prev.plannings !== next.plannings) {
    const changed = Object.values(next.plannings).filter((p) => !same(prev.plannings[p.planId], p))
    const removed = Object.keys(prev.plannings).filter((id) => !(id in next.plannings))
    if (changed.length) upserts.plannings = changed
    if (removed.length) deletes.plannings = removed
  }

  const settings: SettingsPatch = {}
  for (const key of SETTINGS_KEYS) {
    if (!same(prev[key], next[key])) (settings as Record<string, unknown>)[key] = next[key]
  }

  const req: SyncRequest = {}
  if (Object.keys(upserts).length) req.upserts = upserts as Upserts
  if (Object.keys(deletes).length) req.deletes = deletes as Deletes
  if (Object.keys(settings).length) req.settings = settings
  return Object.keys(req).length ? req : null
}

export function isEmptySync(req: SyncRequest | null) {
  return !req || (!req.upserts && !req.deletes && !req.settings)
}

/**
 * Remove referências quebradas (ex.: backup editado à mão) para que o estado respeite as
 * chaves estrangeiras do banco. Ids repetidos: vale o último.
 */
export function sanitizeState(s: AppState): AppState {
  const dedupe = <T extends { id: ID }>(list: T[]) => [...new Map(list.map((x) => [x.id, x])).values()]

  const plans = dedupe(s.plans)
  const planIds = new Set(plans.map((p) => p.id))
  const subjects = dedupe(s.subjects).filter((x) => planIds.has(x.planId))
  const subjectIds = new Set(subjects.map((x) => x.id))
  const topics = dedupe(s.topics).filter((x) => subjectIds.has(x.subjectId))
  const topicIds = new Set(topics.map((x) => x.id))
  const fixTopic = <T extends { topicId?: ID }>(x: T): T =>
    x.topicId && !topicIds.has(x.topicId) ? { ...x, topicId: undefined } : x

  const assessments = dedupe(s.assessments ?? []).filter((x) => planIds.has(x.planId) && subjectIds.has(x.subjectId))
  const assessmentIds = new Set(assessments.map((x) => x.id))
  const fixAssessment = (x: AppState['studies'][number]) =>
    x.assessmentId && !assessmentIds.has(x.assessmentId) ? { ...x, assessmentId: undefined } : x

  const studies = dedupe(s.studies)
    .filter((x) => planIds.has(x.planId) && subjectIds.has(x.subjectId))
    .map(fixTopic)
    .map(fixAssessment)
  const studyIds = new Set(studies.map((x) => x.id))
  const reviews = dedupe(s.reviews)
    .filter((x) => planIds.has(x.planId) && subjectIds.has(x.subjectId) && studyIds.has(x.studyId))
    .map(fixTopic)

  const plannings = Object.fromEntries(
    Object.values(s.plannings)
      .filter((p) => planIds.has(p.planId))
      .map((p) => [p.planId, p]),
  )

  return {
    ...s,
    plans,
    activePlanId: s.activePlanId && planIds.has(s.activePlanId) ? s.activePlanId : (plans[0]?.id ?? null),
    subjects,
    topics,
    categories: dedupe(s.categories),
    studies,
    reviews,
    plannings,
    exams: dedupe(s.exams).filter((x) => planIds.has(x.planId)),
    assessments,
    reminders: dedupe(s.reminders),
  }
}
