import { useState } from 'react'
import { CalendarDays, Pencil } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { Plan, Study } from '../../lib/types'
import { WEEKDAYS_LONG, diffDays, fmtDate, inRange, parseDate, pct, startOfWeek, today, totals } from '../../lib/utils'
import { Button, Card, IconButton, ProgressBar } from '../ui'
import { OK, fmtHours } from '../charts/theme'
import { plural } from '../charts/filters'

function Countdown({ date }: { date: string }) {
  const days = diffDays(date, today())
  return (
    <div className="flex flex-col items-center py-2 text-center">
      {days > 0 ? (
        <>
          <p className="text-sm text-muted">{days === 1 ? 'falta' : 'faltam'}</p>
          <p className="text-5xl font-bold tabular text-brand-600 dark:text-brand-300">{days}</p>
          <p className="text-sm font-medium">{days === 1 ? 'dia' : 'dias'}</p>
        </>
      ) : days === 0 ? (
        <p className="text-xl font-semibold">A prova é hoje! Boa sorte 🍀</p>
      ) : (
        <p className="text-lg font-semibold">A prova foi há {plural(-days, 'dia')}</p>
      )}
      <p className="mt-3 text-sm text-muted">
        {WEEKDAYS_LONG[parseDate(date).getDay()]}, {fmtDate(date)}
      </p>
    </div>
  )
}

export function ExamDateCard({ plan }: { plan: Plan }) {
  const { savePlan } = useStore()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(plan.examDate ?? '')

  const startEdit = () => {
    setValue(plan.examDate ?? '')
    setEditing(true)
  }
  const save = (examDate?: string) => {
    savePlan({ ...plan, examDate: examDate || undefined })
    setEditing(false)
  }

  return (
    <Card
      title="Data da prova"
      actions={
        plan.examDate &&
        !editing && (
          <IconButton title="Editar data da prova" onClick={startEdit}>
            <Pencil size={15} />
          </IconButton>
        )
      }
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save(value)
          }}
        >
          <label className="block">
            <span className="label">Data da prova</span>
            <input type="date" className="field" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!value}>
              Salvar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            {plan.examDate && (
              <Button type="button" size="sm" variant="ghost" className="ml-auto text-bad hover:text-bad" onClick={() => save()}>
                Remover data
              </Button>
            )}
          </div>
        </form>
      ) : plan.examDate ? (
        <Countdown date={plan.examDate} />
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CalendarDays className="text-brand-400" size={32} />
          <p className="text-sm text-muted">Defina a data da prova para acompanhar a contagem regressiva.</p>
          <Button size="sm" onClick={startEdit}>
            Definir data
          </Button>
        </div>
      )}
    </Card>
  )
}

function GoalRow({ label, current, target, value }: { label: string; current: string; target: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm">
          <b className="tabular">{current}</b>
          <span className="text-muted"> / {target}</span>
        </span>
        <span className="text-xs text-muted">{label}</span>
      </div>
      <ProgressBar value={value} color={value >= 100 ? OK : undefined} />
    </div>
  )
}

export function WeeklyGoalsCard({ plan, studies }: { plan: Plan; studies: Study[] }) {
  const { savePlan } = useStore()
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState('')
  const [questions, setQuestions] = useState('')
  const goal = plan.weeklyGoal
  const t = totals(studies.filter((s) => inRange(s, startOfWeek(today()), today())))

  const startEdit = () => {
    setHours(String(goal.minutes / 60))
    setQuestions(String(goal.questions))
    setEditing(true)
  }
  const save = () => {
    savePlan({
      ...plan,
      weeklyGoal: { minutes: Math.max(0, Math.round((Number(hours.replace(',', '.')) || 0) * 60)), questions: Math.max(0, Math.round(Number(questions) || 0)) },
    })
    setEditing(false)
  }

  return (
    <Card
      title="Metas de estudo semanal"
      actions={
        !editing && (
          <IconButton title="Editar metas" onClick={startEdit}>
            <Pencil size={15} />
          </IconButton>
        )
      }
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Horas</span>
              <input type="number" min={0} step={0.5} className="field" value={hours} onChange={(e) => setHours(e.target.value)} autoFocus />
            </label>
            <label>
              <span className="label">Questões</span>
              <input type="number" min={0} step={1} className="field" value={questions} onChange={(e) => setQuestions(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Salvar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : goal.minutes || goal.questions ? (
        <div className="space-y-4">
          <GoalRow
            label="Horas de estudo"
            current={fmtHours(t.duration / 3600)}
            target={fmtHours(goal.minutes / 60)}
            value={pct(t.duration, goal.minutes * 60)}
          />
          <GoalRow label="Questões" current={String(t.questions)} target={String(goal.questions)} value={pct(t.questions, goal.questions)} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-muted">Defina metas semanais de horas e questões para acompanhar seu ritmo.</p>
          <Button size="sm" onClick={startEdit}>
            Definir metas
          </Button>
        </div>
      )}
    </Card>
  )
}
