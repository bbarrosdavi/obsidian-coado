import { useState, type ReactNode } from 'react'
import { CalendarDays, Check, RefreshCcw } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { Planning, PlanningConfig } from '../../lib/types'
import { clsx, fmtMinutes, generateCycle, subjectWeight, today, WEEKDAYS_LONG } from '../../lib/utils'
import { Button, ColorDot, Modal } from '../ui'

const STEPS = ['Organização', 'Disciplinas', 'Relevância', 'Horários']

const range = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let v = from; v <= to; v += step) out.push(v)
  return out
}
const MIN_OPTIONS = range(30, 180, 15)
const MAX_OPTIONS = range(60, 240, 15)
/** garante que o valor atual (vindo de um planejamento antigo) apareça nas opções */
const withValue = (opts: number[], v: number) => (opts.includes(v) ? opts : [...opts, v].sort((a, b) => a - b))

interface Weight {
  importance: number
  knowledge: number
}
const DEFAULT_WEIGHT: Weight = { importance: 1, knowledge: 3 }

export function PlanningWizard({ existing, onClose }: { existing: Planning | null; onClose: () => void }) {
  const { plan, subjects, savePlanning } = useStore()
  const cfg = existing?.config

  const [step, setStep] = useState(0)
  const [type, setType] = useState<Planning['type']>(existing?.type ?? 'cycle')
  const [selected, setSelected] = useState<Set<string>>(() => {
    const ids = subjects.map((s) => s.id)
    if (!cfg?.subjects.length) return new Set(ids)
    const configured = new Set(cfg.subjects.map((s) => s.subjectId))
    return new Set(ids.filter((id) => configured.has(id)))
  })
  const [weights, setWeights] = useState<Record<string, Weight>>(() =>
    Object.fromEntries((cfg?.subjects ?? []).map((s) => [s.subjectId, { importance: s.importance, knowledge: s.knowledge }])),
  )
  const [hours, setHours] = useState(() => String(+((cfg?.weeklyMinutes ?? (plan?.weeklyGoal.minutes || 600)) / 60).toFixed(2)))
  const [days, setDays] = useState<boolean[]>(() => cfg?.days ?? [false, true, true, true, true, true, true])
  const [minSession, setMinSession] = useState(cfg?.minSession ?? 30)
  const [maxSession, setMaxSession] = useState(cfg?.maxSession ?? 120)

  const chosen = subjects.filter((s) => selected.has(s.id))
  const weightOf = (id: string) => weights[id] ?? DEFAULT_WEIGHT
  const setWeight = (id: string, patch: Partial<Weight>) => setWeights((w) => ({ ...w, [id]: { ...weightOf(id), ...patch } }))

  const rawShares = chosen.map((s) => ({ subject: s, w: subjectWeight(weightOf(s.id).importance, weightOf(s.id).knowledge) }))
  const weightSum = rawShares.reduce((a, r) => a + r.w, 0)
  const shares = rawShares.map((r) => ({ ...r, pct: weightSum > 0 ? (r.w / weightSum) * 100 : 0 }))

  const weeklyMinutes = Math.round((parseFloat(hours.replace(',', '.')) || 0) * 60)
  const errors: (string | null)[] = [
    null,
    chosen.length ? null : 'Selecione ao menos uma disciplina.',
    null,
    weeklyMinutes <= 0
      ? 'Informe quantas horas pretende estudar por semana.'
      : !days.some(Boolean)
        ? 'Selecione ao menos um dia de estudo.'
        : maxSession < minSession
          ? 'A duração máxima deve ser maior ou igual à mínima.'
          : null,
  ]
  const error = errors[step]
  const last = step === STEPS.length - 1

  const finish = () => {
    if (!plan) return
    const config: PlanningConfig = {
      weeklyMinutes,
      days,
      minSession,
      maxSession,
      subjects: chosen.map((s) => ({ subjectId: s.id, ...weightOf(s.id) })),
    }
    savePlanning({
      planId: plan.id,
      type,
      config,
      cycle: generateCycle(config),
      completedCycles: existing?.completedCycles ?? 0,
      cycleStartedAt: existing?.cycleStartedAt ?? today(),
    })
    onClose()
  }

  const toggleSubject = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar planejamento"
      footer={
        <>
          {error && <p className="mr-auto text-sm text-bad">{error}</p>}
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {last ? (
            <Button onClick={finish} disabled={!!error}>
              <Check size={16} /> Concluir
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={!!error}>
              Próximo
            </Button>
          )}
        </>
      }
    >
      <Stepper step={step} onStep={(i) => i < step && setStep(i)} />

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            active={type === 'cycle'}
            onClick={() => setType('cycle')}
            icon={<RefreshCcw size={22} />}
            title="Ciclo de estudos"
            tag="Flexível"
          >
            As disciplinas são estudadas em sequência, sem dias fixos. Terminou uma, passa para a próxima — ideal para rotinas
            imprevisíveis.
          </OptionCard>
          <OptionCard
            active={type === 'weekly'}
            onClick={() => setType('weekly')}
            icon={<CalendarDays size={22} />}
            title="Planejamento semanal"
            tag="Rotina fixa"
          >
            Cada disciplina é distribuída em dias da semana. Você sabe exatamente o que estudar em cada dia.
          </OptionCard>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Você poderá adicionar outras disciplinas a qualquer momento.</p>
            <button
              className="shrink-0 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              onClick={() => setSelected(selected.size === subjects.length ? new Set() : new Set(subjects.map((s) => s.id)))}
            >
              {selected.size === subjects.length ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          </div>
          {subjects.length === 0 ? (
            <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Este plano ainda não possui disciplinas.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {subjects.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSubject(s.id)} className="h-4 w-4" />
                    <ColorDot color={s.color} />
                    <span className="text-sm">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Disciplinas mais importantes e com menos conhecimento recebem mais tempo no planejamento.
            </p>
            {chosen.map((s) => {
              const w = weightOf(s.id)
              return (
                <div key={s.id} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <ColorDot color={s.color} />
                    <span className="truncate text-sm font-medium">{s.name}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Slider label="Importância" min={0.5} max={5} value={w.importance} onChange={(v) => setWeight(s.id, { importance: v })} />
                    <Slider label="Conhecimento" min={0} max={5} value={w.knowledge} onChange={(v) => setWeight(s.id, { knowledge: v })} />
                  </div>
                </div>
              )
            })}
          </div>
          <aside className="md:sticky md:top-0 md:self-start">
            <p className="label">Distribuição do tempo</p>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-surface-2">
              {shares.map((r) => (
                <div key={r.subject.id} style={{ width: `${r.pct}%`, background: r.subject.color }} title={r.subject.name} />
              ))}
            </div>
            <ul className="space-y-1.5">
              {[...shares]
                .sort((a, b) => b.pct - a.pct)
                .map((r) => (
                  <li key={r.subject.id} className="flex items-center gap-2 text-xs">
                    <ColorDot color={r.subject.color} className="h-2.5 w-2.5" />
                    <span className="min-w-0 flex-1 truncate">{r.subject.name}</span>
                    <span className="tabular font-semibold">{r.pct.toFixed(1)}%</span>
                  </li>
                ))}
            </ul>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className="label" htmlFor="wz-hours">
              Quantas horas, em média, pretende estudar por semana?
            </label>
            <div className="flex items-center gap-2">
              <input
                id="wz-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="field w-32"
              />
              <span className="text-sm text-muted">horas {weeklyMinutes > 0 && `(${fmtMinutes(weeklyMinutes)})`}</span>
            </div>
          </div>
          <div>
            <p className="label">Em quais dias você pretende estudar?</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS_LONG.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days[i]}
                  onClick={() => setDays(days.map((v, j) => (j === i ? !v : v)))}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    days[i]
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Duração mínima e máxima de uma sessão</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="field w-auto" value={minSession} onChange={(e) => setMinSession(Number(e.target.value))} aria-label="Duração mínima">
                {withValue(MIN_OPTIONS, minSession).map((m) => (
                  <option key={m} value={m}>
                    {fmtMinutes(m)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted">até</span>
              <select className="field w-auto" value={maxSession} onChange={(e) => setMaxSession(Number(e.target.value))} aria-label="Duração máxima">
                {withValue(MAX_OPTIONS, maxSession).map((m) => (
                  <option key={m} value={m}>
                    {fmtMinutes(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Stepper({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2">
      {STEPS.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => onStep(i)}
            className={clsx('w-full text-left', i < step ? 'cursor-pointer' : 'cursor-default')}
          >
            <div className={clsx('mb-2 h-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-surface-2')} />
            <span className={clsx('block text-xs font-semibold tabular', i <= step ? 'text-brand-600 dark:text-brand-300' : 'text-muted')}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={clsx('hidden text-sm sm:block', i === step ? 'font-medium text-ink' : 'text-muted')}>{label}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function OptionCard({
  active,
  onClick,
  icon,
  title,
  tag,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  tag: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition',
        active ? 'border-brand-600 bg-brand-50 dark:bg-brand-600/10' : 'border-line hover:border-brand-300',
      )}
    >
      <span
        className={clsx(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          active ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {icon}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <span className="mt-1 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{tag}</span>
      </div>
      <p className="text-sm text-muted">{children}</p>
      {active && (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check size={13} />
        </span>
      )}
    </button>
  )
}

function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
        <span className="tabular text-ink">{value.toFixed(1).replace('.', ',')}</span>
      </span>
      <input type="range" min={min} max={max} step={0.5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  )
}
