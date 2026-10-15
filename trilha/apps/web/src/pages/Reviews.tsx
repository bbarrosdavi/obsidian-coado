import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Ban, Check, FolderOpen, Info, NotebookPen, Plus, RefreshCcw, RotateCcw, X } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, Empty, Tabs } from '../components/ui'
import { useStore } from '../lib/store'
import type { DateStr, Review } from '../lib/types'
import { addDays, clsx, diffDays, fmtDate, parseDate, today, WEEKDAYS_LONG } from '../lib/utils'
import { BRAND } from '../lib/brand'

type Tab = 'scheduled' | 'late' | 'ignored' | 'done'

const dayLabel = (d: DateStr, ref: DateStr) => {
  if (d === ref) return 'Hoje'
  if (d === addDays(ref, 1)) return 'Amanhã'
  if (d === addDays(ref, -1)) return 'Ontem'
  return `${fmtDate(d)} · ${WEEKDAYS_LONG[parseDate(d).getDay()]}`
}

const intervalLabel = (n: number) => (n === 1 ? '24h' : `${n} dias`)

export default function ReviewsPage() {
  const { plan, reviews, subjects } = useStore()
  const [tab, setTab] = useState<Tab>('scheduled')
  const [subjectId, setSubjectId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  if (!plan) {
    return (
      <>
        <PageHeader title="Revisões" />
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
            Crie ou selecione um plano de estudos para acompanhar suas revisões.
          </Empty>
        </Card>
      </>
    )
  }

  const ref = today()
  const byTab: Record<Tab, Review[]> = {
    scheduled: reviews.filter((r) => r.status === 'pending' && r.dueDate >= ref),
    late: reviews.filter((r) => r.status === 'pending' && r.dueDate < ref),
    ignored: reviews.filter((r) => r.status === 'ignored'),
    done: reviews.filter((r) => r.status === 'done'),
  }

  const filtered = byTab[tab]
    .filter((r) => (!subjectId || r.subjectId === subjectId) && (!from || r.dueDate >= from) && (!to || r.dueDate <= to))
    .sort((a, b) => (tab === 'scheduled' ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate)))

  const groups = filtered.reduce<{ date: DateStr; items: Review[] }[]>((acc, r) => {
    const g = acc[acc.length - 1]
    if (g?.date === r.dueDate) g.items.push(r)
    else acc.push({ date: r.dueDate, items: [r] })
    return acc
  }, [])

  const hasFilters = subjectId || from || to
  const lateCount = byTab.late.length

  return (
    <>
      <PageHeader title="Revisões" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'scheduled', label: `Programadas (${byTab.scheduled.length})` },
              {
                value: 'late',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    Atrasadas
                    {lateCount > 0 && (
                      <span className="rounded-full bg-bad px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular">{lateCount}</span>
                    )}
                  </span>
                ),
              },
              { value: 'ignored', label: 'Ignoradas' },
              { value: 'done', label: 'Concluídas' },
            ]}
          />

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <label className="label" htmlFor="rv-subject">
                Disciplina
              </label>
              <select id="rv-subject" className="field" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Todas as disciplinas</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rv-from">
                De
              </label>
              <input id="rv-from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rv-to">
                Até
              </label>
              <input id="rv-to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSubjectId('')
                  setFrom('')
                  setTo('')
                }}
              >
                <X size={14} /> Limpar
              </Button>
            )}
          </div>

          {groups.length === 0 ? (
            <Card>
              <EmptyReviews />
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.date}>
                <h3 className={clsx('mb-2 text-sm font-semibold', g.date === ref ? 'text-brand-600 dark:text-brand-300' : 'text-muted')}>
                  {dayLabel(g.date, ref)}
                  <span className="ml-2 text-xs font-normal">({g.items.length})</span>
                </h3>
                <div className="space-y-2">
                  {g.items.map((r) => (
                    <ReviewCard key={r.id} review={r} late={tab === 'late' ? diffDays(ref, r.dueDate) : 0} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <IntervalsCard />
      </div>
    </>
  )
}

function EmptyReviews() {
  const { openStudy } = useStore()
  return (
    <Empty
      icon={<RefreshCcw size={36} />}
      title="Ops, parece que você não possui revisões aqui."
      action={
        <Button onClick={() => openStudy()}>
          <Plus size={16} /> Adicionar estudo
        </Button>
      }
    >
      Ao registrar um estudo, agende revisões para fixar o conteúdo.
    </Empty>
  )
}

function ReviewCard({ review: r, late }: { review: Review; late: number }) {
  const { state, openStudy, setReviewStatus } = useStore()
  const subject = state.subjects.find((s) => s.id === r.subjectId)
  const topic = state.topics.find((t) => t.id === r.topicId)
  const origin = state.studies.find((s) => s.id === r.studyId)

  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <span className="w-1.5 shrink-0" style={{ background: subject?.color ?? '#ccc' }} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{subject?.name ?? 'Disciplina removida'}</p>
          <p className="mt-0.5 font-medium">{topic?.name ?? 'Sem tópico'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium text-ink">Revisão de {intervalLabel(r.interval)}</span>
            {origin && <span>Estudo em {fmtDate(origin.date)}</span>}
            {late > 0 && (
              <span className="font-medium text-bad">
                {late} {late === 1 ? 'dia' : 'dias'} de atraso
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === 'pending' ? (
            <>
              <Button
                size="sm"
                onClick={() => openStudy({ subjectId: r.subjectId, topicId: r.topicId, categoryId: 'revisao', reviewId: r.id })}
              >
                <NotebookPen size={14} /> Registrar revisão
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setReviewStatus(r.id, 'done')}>
                <Check size={14} /> Concluir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReviewStatus(r.id, 'ignored')}>
                <Ban size={14} /> Ignorar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setReviewStatus(r.id, 'pending')}>
              <RotateCcw size={14} /> Reabrir
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function IntervalsCard() {
  const { state, update } = useStore()
  const [value, setValue] = useState('')
  const intervals = state.reviewIntervals

  const save = (next: number[]) => update((s) => ({ ...s, reviewIntervals: [...new Set(next)].sort((a, b) => a - b) }))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = Math.round(Number(value))
    if (n >= 1) save([...intervals, n])
    setValue('')
  }

  return (
    <Card title="Revisão espaçada" className="self-start">
      <div className="flex gap-3 text-sm text-muted">
        <Info size={18} className="mt-0.5 shrink-0 text-brand-500" />
        <p>
          Revisar o conteúdo em intervalos crescentes combate a curva do esquecimento e fixa a matéria na memória de longo prazo. Ao
          registrar um estudo, o {BRAND} agenda revisões automaticamente nos intervalos abaixo.
        </p>
      </div>

      <p className="label mt-5">Intervalos padrão</p>
      <div className="flex flex-wrap gap-2">
        {intervals.length === 0 && <span className="text-sm text-muted">Nenhum intervalo definido.</span>}
        {intervals.map((n) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
            {intervalLabel(n)}
            <button
              onClick={() => save(intervals.filter((x) => x !== n))}
              className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-600/30"
              aria-label={`Remover intervalo de ${intervalLabel(n)}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          type="number"
          min={1}
          className="field"
          placeholder="Dias (ex.: 15)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Novo intervalo em dias"
        />
        <Button type="submit" variant="secondary" disabled={!(Number(value) >= 1)}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>
    </Card>
  )
}
