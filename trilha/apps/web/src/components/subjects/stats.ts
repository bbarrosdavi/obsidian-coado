import type { DateStr, ID, Study } from '../../lib/types'

/** Resumo de estudos agrupados (por tópico, por disciplina…) */
export interface StudyStat {
  count: number
  last?: DateStr
  hits: number
  misses: number
  duration: number
}

export const emptyStat = (): StudyStat => ({ count: 0, hits: 0, misses: 0, duration: 0 })

export function statsBy(studies: Study[], key: (s: Study) => ID | undefined): Map<ID, StudyStat> {
  const map = new Map<ID, StudyStat>()
  for (const s of studies) {
    const k = key(s)
    if (!k) continue
    const st = map.get(k) ?? emptyStat()
    st.count++
    st.hits += s.hits
    st.misses += s.misses
    st.duration += s.duration
    if (!st.last || s.date > st.last) st.last = s.date
    map.set(k, st)
  }
  return map
}

/** Remove marcadores de lista ("-", "•", "*", "–") do início da linha */
export const stripBullet = (line: string) => line.replace(/^\s*[-•*–]\s*/, '').trim()

/** Aceita apenas http(s); completa "site.com" com https:// */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z][\w+.-]*:\/\//i.test(v) || /^(javascript|data|vbscript):/i.test(v)) return null
  return `https://${v}`
}
