import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Check, PencilLine, Play, Plus } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { Study, Subject } from '../../lib/types'
import { cycleProgress, fmtDuration, fmtMinutes, startOfMonth, startOfWeek, today } from '../../lib/utils'
import { Button, Card, ColorDot, IconButton, ProgressBar, Tabs } from '../ui'
import { editDraft, groupBy, plural, sortRecent } from '../charts/filters'
import { DateBadge } from './DateBadge'

const linkCls = 'text-xs font-medium text-brand-600 hover:underline dark:text-brand-300'

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={linkCls}>
      {children}
    </Link>
  )
}

const useSubjectMap = () => {
  const { state } = useStore()
  return new Map<string, Subject>(state.subjects.map((s) => [s.id, s]))
}

export function TodayReviewsCard({ className }: { className?: string }) {
  const { reviews, state, openStudy, setReviewStatus } = useStore()
  const subjectMap = useSubjectMap()
  const ref = today()
  const due = reviews.filter((r) => r.status === 'pending' && r.dueDate <= ref).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <Card title="Revisões de hoje" className={className} actions={<CardLink to="/revisoes">ver todas</CardLink>}>
      {due.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Você não tem revisões para hoje.</p>
      ) : (
        <ul className="-my-1 max-h-80 divide-y divide-line overflow-y-auto">
          {due.map((r) => {
            const subject = subjectMap.get(r.subjectId)
            const topic = r.topicId ? state.topics.find((t) => t.id === r.topicId) : undefined
            const late = r.dueDate < ref
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <ColorDot color={subject?.color ?? '#ccc'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{subject?.name ?? 'Disciplina removida'}</p>
                  {topic && <p className="truncate text-xs text-muted">{topic.name}</p>}
                  <p className="text-[11px] text-muted">
                    Revisão de {plural(r.interval, 'dia')}
                    {late && <span className="ml-1.5 rounded bg-bad/10 px-1.5 py-0.5 font-semibold text-bad">atrasada</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Registrar estudo da revisão"
                    onClick={() => openStudy({ subjectId: r.subjectId, topicId: r.topicId, categoryId: 'revisao', reviewId: r.id })}
                  >
                    <PencilLine size={14} /> Registrar
                  </Button>
                  <Button size="sm" variant="ghost" className="hover:text-ok" onClick={() => setReviewStatus(r.id, 'done')}>
                    <Check size={14} /> Concluir
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function PlanningCard({ className }: { className?: string }) {
  const { planning, studies, openTimer, openStudy } = useStore()
  const subjectMap = useSubjectMap()

  if (!planning || planning.cycle.length === 0)
    return (
      <Card title="Planejamento" className={className}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CalendarRange className="text-brand-400" size={32} />
          <p className="text-sm text-muted">Monte um ciclo de estudos e saiba sempre o que estudar a seguir.</p>
          <Link to="/planejamento" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            Criar planejamento
          </Link>
        </div>
      </Card>
    )

  const items = cycleProgress(planning, studies)
  const done = items.filter((i) => i.done).length
  const next = items.filter((i) => !i.done).slice(0, 5)

  return (
    <Card title="Planejamento" className={className} actions={<CardLink to="/planejamento">ver ciclo</CardLink>}>
      <p className="mb-3 text-xs text-muted">
        Ciclo {planning.completedCycles + 1} · {done} de {items.length} sessões concluídas
      </p>
      {next.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Ciclo concluído! 🎉 Reinicie o ciclo em Planejamento.</p>
      ) : (
        <ul className="space-y-3">
          {next.map((it) => {
            const subject = subjectMap.get(it.subjectId)
            const color = subject?.color ?? '#ccc'
            return (
              <li key={it.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <ColorDot color={color} />
                      <span className="truncate">{subject?.name ?? 'Disciplina removida'}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular text-muted">
                      {fmtDuration(it.studied)} / {fmtMinutes(it.duration)}
                    </span>
                  </div>
                  <ProgressBar value={(it.studied / (it.duration * 60)) * 100} color={color} />
                </div>
                <IconButton title="Iniciar cronômetro" onClick={() => openTimer({ subjectId: it.subjectId })}>
                  <Play size={15} />
                </IconButton>
                <IconButton title="Adicionar estudo" onClick={() => openStudy({ subjectId: it.subjectId })}>
                  <Plus size={16} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

type Range = 'today' | 'week' | 'month' | 'total'

export function StudyTimeCard({ studies, subjects, className }: { studies: Study[]; subjects: Subject[]; className?: string }) {
  const [range, setRange] = useState<Range>('today')
  const ref = today()
  const from = { today: ref, week: startOfWeek(ref), month: startOfMonth(ref), total: '' }[range]
  const filtered = studies.filter((s) => s.date >= from && s.date <= ref)
  const bySubject = groupBy(filtered, (s) => s.subjectId)
  const rows = subjects
    .map((s) => ({ subject: s, duration: (bySubject.get(s.id) ?? []).reduce((a, x) => a + x.duration, 0) }))
    .filter((r) => r.duration > 0)
    .sort((a, b) => b.duration - a.duration)
  const max = rows[0]?.duration ?? 0
  const total = rows.reduce((a, r) => a + r.duration, 0)

  return (
    <Card title="Tempo de estudo" className={className}>
      <Tabs
        value={range}
        onChange={setRange}
        options={[
          { value: 'today', label: 'Hoje' },
          { value: 'week', label: 'Semana' },
          { value: 'month', label: 'Mês' },
          { value: 'total', label: 'Total' },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {range === 'today' ? 'Você ainda não estudou hoje 😞' : 'Nenhum estudo registrado neste período.'}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">
            Total: <b className="text-ink">{fmtDuration(total)}</b>
          </p>
          <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto">
            {rows.map(({ subject, duration }) => (
              <li key={subject.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{subject.name}</span>
                  <span className="shrink-0 text-xs font-medium tabular">{fmtDuration(duration)}</span>
                </div>
                <ProgressBar value={(duration / max) * 100} color={subject.color} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

export function RecentCard({ studies, className }: { studies: Study[]; className?: string }) {
  const { state, openStudy } = useStore()
  const subjectMap = useSubjectMap()
  const recent = sortRecent(studies).slice(0, 5)

  return (
    <Card title="Últimas atividades" className={className} actions={<CardLink to="/historico">ver histórico</CardLink>}>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted">Nenhum estudo registrado ainda.</p>
          <Button size="sm" onClick={() => openStudy()}>
            Adicionar estudo
          </Button>
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">
          {recent.map((s) => {
            const subject = subjectMap.get(s.subjectId)
            const topic = s.topicId ? state.topics.find((t) => t.id === s.topicId) : undefined
            return (
              <li key={s.id}>
                <button
                  onClick={() => openStudy(editDraft(s))}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-surface-2"
                >
                  <DateBadge date={s.date} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-semibold uppercase tracking-wide">
                      <ColorDot color={subject?.color ?? '#ccc'} className="h-2 w-2" />
                      <span className="truncate">{subject?.name ?? 'Disciplina removida'}</span>
                    </p>
                    <p className="truncate text-sm text-muted">{topic?.name ?? 'Sem tópico'}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular">{fmtDuration(s.duration)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
