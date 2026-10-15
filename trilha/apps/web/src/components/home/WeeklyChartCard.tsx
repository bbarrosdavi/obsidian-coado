import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Study } from '../../lib/types'
import { WEEKDAYS_LONG, addDays, dateRange, fmtDayMonth, fmtDuration, inRange, parseDate, startOfWeek, today, totals, weekdayShort } from '../../lib/utils'
import { Card, IconButton, Tabs } from '../ui'
import { groupBy } from '../charts/filters'
import { BAD, BRAND, OK, axisProps, gridProps, toHours, tooltipProps } from '../charts/theme'

type Mode = 'time' | 'questions'

export function WeeklyChartCard({ studies, className }: { studies: Study[]; className?: string }) {
  const [offset, setOffset] = useState(0)
  const [mode, setMode] = useState<Mode>('time')
  const start = addDays(startOfWeek(today()), offset * 7)
  const end = addDays(start, 6)
  const week = studies.filter((s) => inRange(s, start, end))
  const byDay = groupBy(week, (s) => s.date)
  const data = dateRange(start, end).map((date) => {
    const t = totals(byDay.get(date) ?? [])
    return { date, label: weekdayShort(date), hours: toHours(t.duration), hits: t.hits, misses: t.misses }
  })
  const t = totals(week)

  return (
    <Card
      title="Estudo semanal"
      className={className}
      actions={
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            { value: 'time', label: 'Tempo' },
            { value: 'questions', label: 'Questões' },
          ]}
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton title="Semana anterior" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="text-xs font-medium tabular text-muted">
            {fmtDayMonth(start)} ~ {fmtDayMonth(end)}
          </span>
          <IconButton title="Próxima semana" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="disabled:opacity-30">
            <ChevronRight size={16} />
          </IconButton>
        </div>
        <p className="text-sm text-muted">
          Total estudado:{' '}
          <b className="text-ink">{mode === 'time' ? fmtDuration(t.duration) : `${t.questions} questões`}</b>
        </p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={mode === 'time'} tickFormatter={(v) => (mode === 'time' ? `${v}h` : String(v))} />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.date as string | undefined
                return d ? `${WEEKDAYS_LONG[parseDate(d).getDay()]}, ${fmtDayMonth(d)}` : ''
              }}
              formatter={(v, name) => (mode === 'time' ? [fmtDuration(Number(v) * 3600), 'Tempo'] : [v, name])}
            />
            {mode === 'time' ? (
              <Bar dataKey="hours" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={40} />
            ) : (
              [
                <Bar key="hits" dataKey="hits" name="Acertos" stackId="q" fill={OK} maxBarSize={40} />,
                <Bar key="misses" dataKey="misses" name="Erros" stackId="q" fill={BAD} radius={[6, 6, 0, 0]} maxBarSize={40} />,
              ]
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
