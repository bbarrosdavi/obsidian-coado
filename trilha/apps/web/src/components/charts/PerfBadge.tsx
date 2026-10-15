import { clsx, pct } from '../../lib/utils'

/** Selo de % de acertos colorido por faixa */
export function PerfBadge({ hits, misses }: { hits: number; misses: number }) {
  const total = hits + misses
  if (!total) return <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">—</span>
  const p = pct(hits, total)
  return (
    <span
      className={clsx(
        'rounded-md px-2 py-0.5 text-xs font-semibold tabular',
        p >= 80 ? 'bg-ok/10 text-ok' : p >= 60 ? 'bg-warn/10 text-warn' : 'bg-bad/10 text-bad',
      )}
    >
      {p}%
    </span>
  )
}
