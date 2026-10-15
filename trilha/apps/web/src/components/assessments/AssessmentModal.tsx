import { useState } from 'react'
import { useStore } from '../../lib/store'
import type { Assessment, AssessmentKind } from '../../lib/types'
import { ASSESSMENT_KINDS } from '../../lib/modo'
import { today } from '../../lib/utils'
import { Button, Modal } from '../ui'

interface Form {
  subjectId: string
  name: string
  kind: AssessmentKind
  date: string
  time: string
  weight: string
  grade: string
  maxGrade: string
  done: boolean
  notes: string
}

const num = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return v.trim() && Number.isFinite(n) ? n : undefined
}

export function AssessmentModal({ assessment, subjectId, onClose }: { assessment?: Assessment; subjectId?: string; onClose: () => void }) {
  const { subjects, saveAssessment } = useStore()
  const [f, setF] = useState<Form>({
    subjectId: assessment?.subjectId ?? subjectId ?? '',
    name: assessment?.name ?? '',
    kind: assessment?.kind ?? 'prova',
    date: assessment?.date ?? today(),
    time: assessment?.time ?? '',
    weight: assessment?.weight ?? '',
    grade: assessment?.grade?.toString() ?? '',
    maxGrade: assessment?.maxGrade?.toString() ?? '',
    done: assessment?.done ?? false,
    notes: assessment?.notes ?? '',
  })
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.subjectId && f.name.trim() && f.date

  const save = () => {
    if (!valid) return
    saveAssessment({
      id: assessment?.id,
      subjectId: f.subjectId,
      name: f.name.trim(),
      kind: f.kind,
      date: f.date,
      time: f.time || undefined,
      weight: f.weight.trim() || undefined,
      grade: num(f.grade),
      maxGrade: num(f.maxGrade),
      done: f.done,
      notes: f.notes.trim(),
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={assessment ? 'Editar avaliação' : 'Nova avaliação'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!valid}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="as-subject">
            Disciplina *
          </label>
          <select id="as-subject" className="field" value={f.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
            <option value="">Selecione…</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="as-kind">
            Tipo
          </label>
          <select id="as-kind" className="field" value={f.kind} onChange={(e) => set('kind', e.target.value as AssessmentKind)}>
            {ASSESSMENT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="as-name">
            Nome *
          </label>
          <input
            id="as-name"
            autoFocus
            className="field"
            value={f.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ex.: P1, Lista 3, Relatório do laboratório"
          />
        </div>
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <div>
            <label className="label" htmlFor="as-date">
              Data *
            </label>
            <input id="as-date" type="date" className="field" value={f.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="as-time">
              Hora
            </label>
            <input id="as-time" type="time" className="field" value={f.time} onChange={(e) => set('time', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="as-weight">
            Peso
          </label>
          <input
            id="as-weight"
            className="field"
            value={f.weight}
            onChange={(e) => set('weight', e.target.value)}
            placeholder="Ex.: 30%, 2, metade da média"
          />
        </div>
        <div>
          <span className="label">Nota</span>
          <div className="flex items-center gap-2">
            <input
              className="field tabular"
              inputMode="decimal"
              value={f.grade}
              onChange={(e) => set('grade', e.target.value)}
              aria-label="Nota obtida"
              placeholder="8,5"
            />
            <span className="text-muted">/</span>
            <input
              className="field tabular"
              inputMode="decimal"
              value={f.maxGrade}
              onChange={(e) => set('maxGrade', e.target.value)}
              aria-label="Nota máxima"
              placeholder="10"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={f.done} onChange={(e) => set('done', e.target.checked)} />
          {f.kind === 'prova' ? 'Prova feita' : 'Entregue'}
        </label>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="as-notes">
            Observações
          </label>
          <textarea
            id="as-notes"
            rows={3}
            className="field"
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Conteúdo cobrado, formato de entrega, combinados com o professor"
          />
        </div>
      </div>
    </Modal>
  )
}
