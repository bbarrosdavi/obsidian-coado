import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Study } from '../../lib/types'
import { addDays, clsx, constancy, dateRange, fmtDate, fmtDayMonth, today, weekdayShort, type Constancy } from '../../lib/utils'
import { Card, IconButton } from '../ui'
import { plural } from '../charts/filters'

const WINDOW = 14
/** quantos dias futuros aparecem na janela atual */
const AHEAD = 3

function Message({ c }: { c: Constancy }) {
  if (c.daysSinceLast === null) return <>Você ainda não registrou nenhum estudo. Que tal começar hoje?</>
  if (c.current > 0)
    return (
      <>
        Sequência atual: <b>{plural(c.current, 'dia')}</b> 🔥 {c.daysSinceLast > 0 && 'Estude hoje para não perder a sequência! '}
        Seu recorde é de <b>{plural(c.record, 'dia')}</b> seguidos.
      </>
    )
  return (
    <>
      Você está há <b className="text-bad">{plural(c.daysSinceLast, 'dia')}</b> sem estudar! Seu recorde é de <b>{plural(c.record, 'dia')}</b> seguidos.
    </>
  )
}

export function ConstancyCard({ studies, className }: { studies: Study[]; className?: string }) {
  const [offset, setOffset] = useState(0)
  const ref = today()
  const c = useMemo(() => constancy(studies, ref), [studies, ref])
  const start = addDays(ref, offset * WINDOW - (WINDOW - 1 - AHEAD))
  const days = dateRange(start, addDays(start, WINDOW - 1))

  return (
    <Card
      title="Constância nos estudos"
      className={className}
      actions={
        <>
          <IconButton title="Período anterior" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <span className="text-xs font-medium tabular text-muted">
            {fmtDayMonth(days[0])} ~ {fmtDayMonth(days[days.length - 1])}
          </span>
          <IconButton title="Próximo período" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="disabled:opacity-30">
            <ChevronRight size={16} />
          </IconButton>
        </>
      }
    >
      <p className="mb-4 text-sm">
        <Message c={c} />
      </p>
      <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
        {days.map((d) => {
          const studied = c.studiedDays.has(d)
          const future = d > ref
          const isToday = d === ref
          return (
            <div key={d} className={clsx('flex flex-col items-center gap-1', future && 'opacity-40')} title={fmtDate(d)}>
              <span className={clsx('text-[10px] font-semibold', isToday ? 'text-brand-600 dark:text-brand-300' : 'text-muted')}>{weekdayShort(d)}</span>
              <div
                className={clsx(
                  'flex aspect-square w-full max-w-10 items-center justify-center rounded-lg',
                  studied && 'bg-ok/15 text-ok',
                  !studied && !future && !isToday && 'bg-bad/10 text-bad',
                  !studied && isToday && 'border border-dashed border-brand-400 bg-surface-2',
                  future && 'bg-surface-2',
                )}
              >
                {studied ? <Check size={16} strokeWidth={3} /> : !future && !isToday ? <X size={14} strokeWidth={3} /> : null}
              </div>
              <span className="text-[11px] tabular text-muted">{d.slice(8, 10)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
