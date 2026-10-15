import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { CycleItem, Planning } from '../../lib/types'
import { fmtMinutes, subjectColor, uid } from '../../lib/utils'
import { Button, ColorDot, IconButton, Modal } from '../ui'

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15)
const withValue = (v: number) => (DURATIONS.includes(v) ? DURATIONS : [...DURATIONS, v].sort((a, b) => a - b))

function DurationSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <select className="field w-auto py-1.5" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {withValue(value).map((m) => (
        <option key={m} value={m}>
          {fmtMinutes(m)}
        </option>
      ))}
    </select>
  )
}

export function CycleEditor({ planning, onClose }: { planning: Planning; onClose: () => void }) {
  const { state, subjects, savePlanning } = useStore()
  const [items, setItems] = useState<CycleItem[]>(planning.cycle)
  const [newSubject, setNewSubject] = useState(subjects[0]?.id ?? '')
  const [newDuration, setNewDuration] = useState(60)

  const nameOf = (id: string) => state.subjects.find((s) => s.id === id)?.name ?? 'Disciplina removida'
  const total = items.reduce((a, i) => a + i.duration, 0)

  const move = (idx: number, dir: -1 | 1) =>
    setItems((list) => {
      const next = [...list]
      ;[next[idx], next[idx + dir]] = [next[idx + dir], next[idx]]
      return next
    })

  const save = () => {
    savePlanning({ ...planning, cycle: items })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar ciclo"
      footer={
        <>
          <span className="mr-auto text-sm text-muted">
            {items.length} {items.length === 1 ? 'sessão' : 'sessões'} · <span className="tabular font-medium text-ink">{fmtMinutes(total)}</span>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar ciclo</Button>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted">O ciclo está vazio. Adicione sessões abaixo.</p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 text-right text-xs font-semibold tabular text-muted">{idx + 1}</span>
              <ColorDot color={subjectColor(state.subjects, it.subjectId)} />
              <span className="min-w-0 flex-1 truncate text-sm">{nameOf(it.subjectId)}</span>
              <DurationSelect
                label="Duração"
                value={it.duration}
                onChange={(v) => setItems((list) => list.map((x) => (x.id === it.id ? { ...x, duration: v } : x)))}
              />
              <IconButton title="Mover para cima" disabled={idx === 0} onClick={() => move(idx, -1)} className="disabled:opacity-30">
                <ArrowUp size={16} />
              </IconButton>
              <IconButton
                title="Mover para baixo"
                disabled={idx === items.length - 1}
                onClick={() => move(idx, 1)}
                className="disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </IconButton>
              <IconButton title="Remover" onClick={() => setItems((list) => list.filter((x) => x.id !== it.id))} className="hover:text-bad">
                <Trash2 size={16} />
              </IconButton>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 rounded-xl bg-surface-2 p-3">
        <p className="label">Adicionar sessão</p>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field min-w-0 flex-1 py-1.5" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} aria-label="Disciplina">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <DurationSelect label="Duração da nova sessão" value={newDuration} onChange={setNewDuration} />
          <Button
            size="sm"
            disabled={!newSubject}
            onClick={() => setItems((list) => [...list, { id: uid(), subjectId: newSubject, duration: newDuration }])}
          >
            <Plus size={14} /> Adicionar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
