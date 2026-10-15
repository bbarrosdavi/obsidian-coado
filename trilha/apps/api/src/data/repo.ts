import type { AppState, Planning, Settings, SyncRequest, TimerPrefs } from '@coado/shared'
import { DEFAULT_REVIEW_INTERVALS, DEFAULT_TIMER_PREFS } from '@coado/shared'
import type { Db } from '../db'
import { DELETE_ORDER, ENTITIES, UPSERT_ORDER, type Entity } from './entities'

const CHUNK = 1000

const q = (name: string) => `"${name}"`

/**
 * Upsert em lote: as linhas vão como um único parâmetro JSON e o Postgres as expande com
 * jsonb_to_recordset. O user_id vem sempre da sessão, nunca do payload.
 */
async function bulkUpsert<T>(db: Db, userId: string, entity: Entity<T>, items: T[]) {
  if (!items.length) return
  const cols = entity.columns.map(([name]) => q(name))
  const recordDef = entity.columns.map(([name, type]) => `${q(name)} ${type}`).join(', ')
  const updates = entity.columns
    .filter(([name]) => name !== entity.key)
    .map(([name]) => `${q(name)} = excluded.${q(name)}`)
  const sql = `insert into ${q(entity.table)} (user_id, ${cols.join(', ')})
    select $1, ${cols.map((c) => `x.${c}`).join(', ')} from jsonb_to_recordset($2::jsonb) as x(${recordDef})
    on conflict (user_id, ${q(entity.key)}) do update set ${updates.join(', ')}, updated_at = now()`
  for (let i = 0; i < items.length; i += CHUNK) {
    const rows = items.slice(i, i + CHUNK).map(entity.toRow)
    await db.query(sql, [userId, JSON.stringify(rows)])
  }
}

async function bulkDelete(db: Db, userId: string, entity: Entity<unknown>, ids: string[]) {
  if (!ids.length) return
  await db.query(`delete from ${q(entity.table)} where user_id = $1 and ${q(entity.key)} = any($2::text[])`, [userId, ids])
}

interface SettingsRow {
  active_plan_id: string | null
  theme: Settings['theme']
  timer_prefs: TimerPrefs
  review_intervals: number[]
  note: string
}

const SETTINGS_COLUMNS: Record<keyof Settings, { col: string; cast?: string; encode?: (v: unknown) => unknown }> = {
  activePlanId: { col: 'active_plan_id' },
  theme: { col: 'theme' },
  timerPrefs: { col: 'timer_prefs', cast: 'jsonb', encode: (v) => JSON.stringify(v) },
  reviewIntervals: { col: 'review_intervals', cast: 'integer[]' },
  note: { col: 'note' },
}

async function updateSettings(db: Db, userId: string, patch: Partial<Settings>) {
  const keys = (Object.keys(patch) as (keyof Settings)[]).filter((k) => patch[k] !== undefined)
  if (!keys.length) return
  // garante a linha (contas antigas ou criadas por fora do fluxo de login)
  await db.query(
    `insert into user_settings (user_id, timer_prefs, review_intervals) values ($1, $2, $3) on conflict (user_id) do nothing`,
    [userId, JSON.stringify(DEFAULT_TIMER_PREFS), DEFAULT_REVIEW_INTERVALS],
  )
  const values: unknown[] = [userId]
  const sets = keys.map((k) => {
    const { col, cast, encode } = SETTINGS_COLUMNS[k]
    values.push(encode ? encode(patch[k]) : patch[k])
    return `${q(col)} = $${values.length}${cast ? `::${cast}` : ''}`
  })
  await db.query(`update user_settings set ${sets.join(', ')}, updated_at = now() where user_id = $1`, values)
}

/** Estado completo da conta, no formato que o navegador usa */
export async function loadState(db: Db, userId: string): Promise<AppState> {
  const list = async <T>(entity: Entity<T>) => {
    const { rows } = await db.query(`select * from ${q(entity.table)} where user_id = $1 order by ${entity.orderBy}`, [userId])
    return rows.map(entity.fromRow)
  }
  const { rows } = await db.query<SettingsRow>(
    'select active_plan_id, theme, timer_prefs, review_intervals, note from user_settings where user_id = $1',
    [userId],
  )
  const s = rows[0]
  const planningList: Planning[] = await list(ENTITIES.plannings)

  return {
    version: 1,
    plans: await list(ENTITIES.plans),
    activePlanId: s?.active_plan_id ?? null,
    subjects: await list(ENTITIES.subjects),
    topics: await list(ENTITIES.topics),
    categories: await list(ENTITIES.categories),
    studies: await list(ENTITIES.studies),
    reviews: await list(ENTITIES.reviews),
    plannings: Object.fromEntries(planningList.map((p) => [p.planId, p])),
    exams: await list(ENTITIES.exams),
    assessments: await list(ENTITIES.assessments),
    reminders: await list(ENTITIES.reminders),
    note: s?.note ?? '',
    theme: s?.theme ?? 'system',
    timerPrefs: s?.timer_prefs ?? { ...DEFAULT_TIMER_PREFS },
    reviewIntervals: s?.review_intervals ?? [...DEFAULT_REVIEW_INTERVALS],
  }
}

/** Aplica um lote de alterações (chamar dentro de uma transação) */
export async function applySync(db: Db, userId: string, req: SyncRequest) {
  if (req.settings) await updateSettings(db, userId, req.settings)
  for (const name of UPSERT_ORDER) {
    const items = req.upserts?.[name]
    if (items?.length) await bulkUpsert(db, userId, ENTITIES[name] as Entity<unknown>, items)
  }
  for (const name of DELETE_ORDER) {
    const ids = req.deletes?.[name]
    if (ids?.length) await bulkDelete(db, userId, ENTITIES[name] as Entity<unknown>, ids)
  }
}

/** Substitui todos os dados da conta (importação). Arquivos ficam, só perdem o vínculo. */
export async function replaceState(db: Db, userId: string, state: AppState) {
  // plans leva em cascata disciplinas, tópicos, estudos, revisões, planejamentos e simulados
  for (const table of ['plans', 'categories', 'reminders']) {
    await db.query(`delete from ${q(table)} where user_id = $1`, [userId])
  }
  await applySync(db, userId, {
    settings: {
      activePlanId: state.activePlanId,
      theme: state.theme,
      timerPrefs: state.timerPrefs,
      reviewIntervals: state.reviewIntervals,
      note: state.note,
    },
    upserts: {
      categories: state.categories,
      plans: state.plans,
      subjects: state.subjects,
      topics: state.topics,
      assessments: state.assessments ?? [],
      studies: state.studies,
      reviews: state.reviews,
      plannings: Object.values(state.plannings),
      exams: state.exams,
      reminders: state.reminders,
    },
  })
}
