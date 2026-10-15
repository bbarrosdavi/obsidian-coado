import { Link } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { assessmentKindLabel, quando } from '../../lib/modo'
import { clsx, today } from '../../lib/utils'
import { Card, ColorDot } from '../ui'
import { DateBadge } from './DateBadge'

/** Modo universidade: o que vem pela frente, no lugar da contagem para uma prova única */
export function NextAssessmentsCard({ className, limit = 4 }: { className?: string; limit?: number }) {
  const { assessments, state } = useStore()
  const ref = today()
  const pending = assessments.filter((a) => !a.done)
  const late = pending.filter((a) => a.date < ref).length
  const next = pending.filter((a) => a.date >= ref).slice(0, limit)

  return (
    <Card
      title="Próximas avaliações"
      className={className}
      actions={
        <Link to="/avaliacoes" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
          ver todas
        </Link>
      }
    >
      {late > 0 && (
        <Link to="/avaliacoes" className="mb-2 block rounded-lg bg-bad/10 px-3 py-1.5 text-xs font-semibold text-bad">
          {late === 1 ? '1 atrasada' : `${late} atrasadas`}
        </Link>
      )}
      {next.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nada marcado pela frente.</p>
      ) : (
        <ul className="-my-1 divide-y divide-line">
          {next.map((a) => {
            const subject = state.subjects.find((s) => s.id === a.subjectId)
            const soon = a.date <= ref
            return (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <DateBadge date={a.date} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ColorDot color={subject?.color ?? '#ccc'} />
                    <span className="truncate">{subject?.name ?? 'Disciplina removida'}</span>
                  </p>
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-[11px] text-muted">{assessmentKindLabel(a.kind)}</p>
                </div>
                <span className={clsx('shrink-0 text-xs font-semibold', soon ? 'text-bad' : 'text-muted')}>{quando(a.date, ref)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
