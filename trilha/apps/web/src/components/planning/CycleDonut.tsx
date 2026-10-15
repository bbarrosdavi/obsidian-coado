import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { CycleItem, Subject } from '../../lib/types'
import { clsx, fmtMinutes, pct } from '../../lib/utils'
import { ColorDot } from '../ui'

interface Slice {
  id: string
  name: string
  color: string
  value: number
}

export function CycleDonut({ cycle, subjects, horizontal }: { cycle: CycleItem[]; subjects: Subject[]; horizontal?: boolean }) {
  const find = (id: string) => subjects.find((s) => s.id === id)
  const total = cycle.reduce((a, c) => a + c.duration, 0)

  const slices: Slice[] = cycle.map((c) => ({
    id: c.id,
    name: find(c.subjectId)?.name ?? 'Disciplina removida',
    color: find(c.subjectId)?.color ?? '#ccc',
    value: c.duration,
  }))

  const legend = [...cycle.reduce((m, c) => m.set(c.subjectId, (m.get(c.subjectId) ?? 0) + c.duration), new Map<string, number>())]
    .map(([id, minutes]) => ({ id, minutes, name: find(id)?.name ?? 'Disciplina removida', color: find(id)?.color ?? '#ccc' }))
    .sort((a, b) => b.minutes - a.minutes)

  if (!total) return <p className="py-8 text-center text-sm text-muted">O ciclo está vazio.</p>

  return (
    <div className={clsx(horizontal && 'sm:flex sm:items-center sm:gap-8')}>
      <div className={clsx('relative mx-auto h-56 max-w-64', horizontal && 'sm:mx-0 sm:w-56 sm:shrink-0')}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 1 : 0}
              stroke="var(--app-surface)"
              strokeWidth={1}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const s = payload[0].payload as Slice
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                    <div className="flex items-center gap-2">
                      <ColorDot color={s.color} className="h-2.5 w-2.5" />
                      <span className="font-medium">{s.name}</span>
                    </div>
                    <div className="mt-0.5 tabular text-muted">{fmtMinutes(s.value)}</div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Total</span>
          <span className="text-2xl font-semibold tabular">{fmtMinutes(total)}</span>
        </div>
      </div>
      <ul className={clsx('mt-5 space-y-2', horizontal && 'sm:mt-0 sm:flex-1 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:space-y-0 lg:gap-y-2')}>
        {legend.map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <ColorDot color={l.color} className="h-2.5 w-2.5" />
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            <span className="tabular text-muted">{fmtMinutes(l.minutes)}</span>
            <span className="w-10 text-right text-xs font-semibold tabular">{pct(l.minutes, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
