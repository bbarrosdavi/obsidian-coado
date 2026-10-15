import type { StudyDraft } from '../../lib/store'
import type { Category, DateStr, Study } from '../../lib/types'
import { addDays, inRange, today } from '../../lib/utils'

export type Period = 'all' | '7' | '30' | '60' | '180' | '365' | 'custom'

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '60', label: '60 dias' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
]

export interface Filters {
  period: Period
  /** usados apenas no período personalizado */
  from: DateStr
  to: DateStr
  subjectId: string
  categoryId: string
}

export const initialFilters = (): Filters => ({
  period: 'all',
  from: addDays(today(), -29),
  to: today(),
  subjectId: '',
  categoryId: '',
})

export function filterRange(f: Filters): { from?: DateStr; to?: DateStr } {
  if (f.period === 'all') return {}
  if (f.period === 'custom') return { from: f.from || undefined, to: f.to || undefined }
  return { from: addDays(today(), -(Number(f.period) - 1)), to: today() }
}

export function applyFilters(studies: Study[], f: Filters) {
  const { from, to } = filterRange(f)
  return studies.filter(
    (s) =>
      inRange(s, from, to) && (!f.subjectId || s.subjectId === f.subjectId) && (!f.categoryId || s.categoryId === f.categoryId),
  )
}

export const categoryName = (categories: Category[], id: string) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria'

/** Mais recentes primeiro (data + hora) */
export const sortRecent = (studies: Study[]) =>
  [...studies].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))

/** Prefill do modal para editar um estudo existente */
export const editDraft = (s: Study): StudyDraft => ({
  date: s.date,
  time: s.time,
  categoryId: s.categoryId,
  subjectId: s.subjectId,
  topicId: s.topicId,
  duration: s.duration,
  material: s.material,
  hits: s.hits,
  misses: s.misses,
  pages: s.pages,
  videos: s.videos,
  comment: s.comment,
  countInPlanning: s.countInPlanning,
  editingId: s.id,
})

export const groupBy = <T, K extends string>(items: T[], key: (t: T) => K) => {
  const map = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const list = map.get(k)
    if (list) list.push(it)
    else map.set(k, [it])
  }
  return map
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
