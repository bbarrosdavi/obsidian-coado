import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Check, Eye, EyeOff, FolderOpen, History, Pencil, Play, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, ColorDot, confirmAction, Empty, IconButton, ProgressBar } from '../components/ui'
import { CycleDonut } from '../components/planning/CycleDonut'
import { CycleEditor } from '../components/planning/CycleEditor'
import { PlanningWizard } from '../components/planning/PlanningWizard'
import { RecentStudiesModal } from '../components/planning/RecentStudiesModal'
import { useStore } from '../lib/store'
import type { Planning } from '../lib/types'
import { clsx, cycleProgress, fmtDuration, fmtMinutes, parseDate, pct, today, weeklySchedule, WEEKDAYS_LONG, type CycleProgressItem } from '../lib/utils'

export default function PlanningPage() {
  const { plan, planning, restartCycle, deletePlanning } = useStore()
  const [wizard, setWizard] = useState(false)

  if (!plan) {
    return (
      <>
        <PageHeader title="Planejamento" />
        <Card>
          <Empty
            icon={<FolderOpen size={36} />}
            title="Nenhum plano ativo"
            action={
              <Link to="/planos" className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Ir para Planos
              </Link>
            }
          >
            Crie ou selecione um plano de estudos para montar seu planejamento.
          </Empty>
        </Card>
      </>
    )
  }

  const restart = () => confirmAction('Recomeçar o ciclo? O progresso atual será zerado e o ciclo contará como completo.') && restartCycle()

  return (
    <>
      <PageHeader title="Planejamento">
        {planning && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={restart}>
              <RotateCcw size={14} /> Recomeçar ciclo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setWizard(true)}>
              <Settings2 size={14} /> Replanejar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-bad"
              onClick={() => confirmAction('Remover o planejamento deste plano?') && deletePlanning(plan.id)}
            >
              <Trash2 size={14} /> Remover
            </Button>
          </div>
        )}
      </PageHeader>

      {planning ? (
        <PlanningView planning={planning} onRestart={restart} />
      ) : (
        <Card>
          <Empty
            icon={<CalendarRange size={40} />}
            title="Você ainda não tem um planejamento"
            action={<Button onClick={() => setWizard(true)}>Criar planejamento</Button>}
          >
            Escolha entre um <strong className="text-ink">ciclo de estudos</strong>, em que as disciplinas se revezam em sequência sem dias
            fixos, ou um <strong className="text-ink">planejamento semanal</strong>, com disciplinas distribuídas pelos dias da semana.
          </Empty>
        </Card>
      )}

      {wizard && <PlanningWizard existing={planning} onClose={() => setWizard(false)} />}
    </>
  )
}

function PlanningView({ planning, onRestart }: { planning: Planning; onRestart: () => void }) {
  const { state, studies } = useStore()
  const [editing, setEditing] = useState(false)
  const [recentOf, setRecentOf] = useState<string | null>(null)

  const items = cycleProgress(planning, studies)
  const planned = items.reduce((a, i) => a + i.duration * 60, 0)
  const studied = items.reduce((a, i) => a + Math.min(i.studied, i.duration * 60), 0)
  const allDone = items.length > 0 && items.every((i) => i.done)
  const progress = pct(studied, planned)

  return (
    <div className="space-y-6">
      {allDone && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-600/30 dark:bg-brand-600/10">
          <div className="mr-auto">
            <p className="text-lg font-semibold">Ciclo concluído! 🎉</p>
            <p className="text-sm text-muted">Você completou todas as sessões. Recomece para iniciar uma nova volta.</p>
          </div>
          <Button onClick={onRestart}>
            <RotateCcw size={16} /> Recomeçar ciclo
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ciclos completos</p>
          <div className="mt-3 text-3xl font-semibold tabular">{planning.completedCycles}</div>
          <p className="mt-1 text-sm text-muted">{planning.type === 'cycle' ? 'Ciclo de estudos' : 'Planejamento semanal'}</p>
        </Card>
        <Card className="sm:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Progresso</p>
            <span className="text-sm font-semibold tabular text-brand-600 dark:text-brand-300">{progress}%</span>
          </div>
          <div className="mt-3 text-2xl font-semibold tabular sm:text-3xl">
            {fmtDuration(studied)} <span className="text-lg font-normal text-muted">/ {fmtMinutes(planned / 60)}</span>
          </div>
          <ProgressBar value={progress} className="mt-3" />
          <p className="mt-2 text-xs text-muted">
            {items.filter((i) => i.done).length} de {items.length} sessões concluídas
          </p>
        </Card>
      </div>

      {planning.type === 'cycle' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CycleSequence items={items} onEdit={() => setEditing(true)} onRecent={setRecentOf} />
          </div>
          <Card title="Ciclo" className="self-start">
            <CycleDonut cycle={planning.cycle} subjects={state.subjects} />
          </Card>
        </div>
      ) : (
        <>
          <WeeklyView planning={planning} items={items} onEdit={() => setEditing(true)} onRecent={setRecentOf} />
          <Card title="Distribuição semanal">
            <CycleDonut cycle={planning.cycle} subjects={state.subjects} horizontal />
          </Card>
        </>
      )}

      {editing && <CycleEditor planning={planning} onClose={() => setEditing(false)} />}
      {recentOf && <RecentStudiesModal subjectId={recentOf} onClose={() => setRecentOf(null)} />}
    </div>
  )
}

function EditCycleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Pencil size={14} /> Editar ciclo
    </Button>
  )
}

function ItemActions({ subjectId, onRecent }: { subjectId: string; onRecent: (id: string) => void }) {
  const { openTimer, openStudy } = useStore()
  return (
    <div className="flex shrink-0 items-center">
      <IconButton title="Iniciar estudo" onClick={() => openTimer({ subjectId })} className="text-brand-600 dark:text-brand-300">
        <Play size={16} />
      </IconButton>
      <IconButton title="Adicionar estudo manualmente" onClick={() => openStudy({ subjectId })}>
        <Plus size={16} />
      </IconButton>
      <IconButton title="Ver últimos estudos" onClick={() => onRecent(subjectId)}>
        <History size={16} />
      </IconButton>
    </div>
  )
}

function CycleSequence({ items, onEdit, onRecent }: { items: CycleProgressItem[]; onEdit: () => void; onRecent: (id: string) => void }) {
  const { state } = useStore()
  const [showDone, setShowDone] = useState(false)
  const doneCount = items.filter((i) => i.done).length
  const visible = items.map((it, idx) => ({ it, pos: idx + 1 })).filter(({ it }) => showDone || !it.done)
  const subjectOf = (id: string) => state.subjects.find((s) => s.id === id)

  return (
    <Card
      title="Sequência dos estudos"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setShowDone(!showDone)}>
            {showDone ? <EyeOff size={14} /> : <Eye size={14} />}
            {showDone ? 'Ocultar finalizados' : `Ver finalizados${doneCount ? ` (${doneCount})` : ''}`}
          </Button>
          <EditCycleButton onClick={onEdit} />
        </>
      }
    >
      {items.length === 0 ? (
        <Empty title="O ciclo está vazio">Use “Editar ciclo” para adicionar sessões ou replaneje.</Empty>
      ) : visible.length === 0 ? (
        <Empty title="Todas as sessões foram finalizadas">Clique em “Ver finalizados” para revê-las.</Empty>
      ) : (
        <ol className="-mx-2 divide-y divide-line">
          {visible.map(({ it, pos }) => {
            const subject = subjectOf(it.subjectId)
            const color = subject?.color ?? '#ccc'
            const p = pct(it.studied, it.duration * 60)
            return (
              <li key={it.id} className={clsx('flex items-center gap-3 px-2 py-3', it.done && 'opacity-60')}>
                <span className="w-6 shrink-0 text-right text-xs font-semibold tabular text-muted">{pos}</span>
                {it.done ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : (
                  <ColorDot color={color} className="mx-1" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={clsx('truncate text-sm font-medium', it.done && 'line-through decoration-muted')}>
                      {subject?.name ?? 'Disciplina removida'}
                    </span>
                    <span className="text-xs tabular text-muted">
                      {fmtDuration(it.studied)} / {fmtMinutes(it.duration)} · <span className="font-semibold text-ink">{p}%</span>
                    </span>
                  </div>
                  <ProgressBar value={p} color={color} className="mt-1.5 h-1.5" />
                </div>
                <ItemActions subjectId={it.subjectId} onRecent={onRecent} />
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

function WeeklyView({
  planning,
  items,
  onEdit,
  onRecent,
}: {
  planning: Planning
  items: CycleProgressItem[]
  onEdit: () => void
  onRecent: (id: string) => void
}) {
  const { state } = useStore()
  const todayIdx = parseDate(today()).getDay()
  const progressById = new Map(items.map((i) => [i.id, i]))
  const subjectOf = (id: string) => state.subjects.find((s) => s.id === id)

  return (
    <Card title="Semana" actions={<EditCycleButton onClick={onEdit} />}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {weeklySchedule(planning).map((b) => {
          const isToday = b.day === todayIdx
          const on = planning.config.days[b.day]
          return (
            <div
              key={b.day}
              className={clsx(
                'flex flex-col rounded-xl border p-3',
                isToday ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20 dark:bg-brand-600/10' : 'border-line',
                !on && 'bg-surface-2 opacity-70',
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={clsx('text-sm font-semibold', isToday && 'text-brand-700 dark:text-brand-300')}>
                  {WEEKDAYS_LONG[b.day]}
                  {isToday && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide">hoje</span>}
                </span>
                {on && <span className="text-xs tabular text-muted">{fmtMinutes(b.minutes)}</span>}
              </div>
              {!on ? (
                <p className="py-4 text-center text-sm text-muted">Folga</p>
              ) : b.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Sem sessões</p>
              ) : (
                <ul className="space-y-1.5">
                  {b.items.map((it) => {
                    const subject = subjectOf(it.subjectId)
                    const done = progressById.get(it.id)?.done
                    return (
                      <li
                        key={it.id}
                        className={clsx('rounded-lg bg-surface px-2 py-1.5 text-sm', done && 'opacity-60')}
                        style={{ borderLeft: `3px solid ${subject?.color ?? '#ccc'}` }}
                      >
                        <span className={clsx('block truncate', done && 'line-through decoration-muted')} title={subject?.name}>
                          {subject?.name ?? 'Disciplina removida'}
                        </span>
                        <span className="flex items-center gap-1 text-xs tabular text-muted">
                          {done && <Check size={12} className="text-ok" />}
                          {fmtMinutes(it.duration)}
                        </span>
                        {isToday && <ItemActions subjectId={it.subjectId} onRecent={onRecent} />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
