import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { Reminder } from '../../lib/types'
import { clsx, fmtDate, today } from '../../lib/utils'
import { Button, Card, IconButton } from '../ui'

const byStatusAndDate = (a: Reminder, b: Reminder) =>
  Number(a.done) - Number(b.done) || (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.createdAt.localeCompare(b.createdAt)

export function RemindersCard({ className }: { className?: string }) {
  const { state, saveReminder, deleteReminder } = useStore()
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const reminders = [...state.reminders].sort(byStatusAndDate)
  const ref = today()

  const add = () => {
    const t = text.trim()
    if (!t) return
    saveReminder({ text: t, date: date || undefined })
    setText('')
    setDate('')
  }

  return (
    <Card title="Lembretes" className={className}>
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input className="field w-full" placeholder="Novo lembrete…" value={text} onChange={(e) => setText(e.target.value)} />
        <input type="date" className="field min-w-0 flex-1" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data do lembrete" />
        <Button type="submit" size="sm" disabled={!text.trim()} aria-label="Adicionar lembrete">
          <Plus size={16} />
        </Button>
      </form>
      {reminders.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">Use este espaço para anotar datas de inscrição, provas, boletos…</p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {reminders.map((r) => {
            const late = !r.done && r.date && r.date < ref
            return (
              <li key={r.id} className="group flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0"
                  checked={r.done}
                  onChange={(e) => saveReminder({ ...r, done: e.target.checked })}
                  aria-label={r.done ? 'Marcar como pendente' : 'Marcar como feito'}
                />
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm break-words', r.done && 'text-muted line-through')}>{r.text}</p>
                  {r.date && <p className={clsx('text-xs tabular', late ? 'font-medium text-bad' : 'text-muted')}>{fmtDate(r.date)}</p>}
                </div>
                <IconButton title="Excluir lembrete" className="hover:text-bad" onClick={() => deleteReminder(r.id)}>
                  <Trash2 size={15} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
