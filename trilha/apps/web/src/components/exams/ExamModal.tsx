import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { Exam, ExamRow } from '../../lib/types'
import { clsx, fmtClock, parseClock, pct, today } from '../../lib/utils'
import { Button, ColorDot, IconButton, Modal } from '../ui'
import { fmtNum, STYLE_LABEL, summarizeExam } from './examUtils'

const num = (v: string) => Math.max(0, Number(v) || 0)
const int = (v: string) => Math.floor(num(v))

export function ExamModal({ exam, onClose }: { exam?: Exam; onClose: () => void }) {
  const { subjects, saveExam } = useStore()
  const [date, setDate] = useState(exam?.date ?? today())
  const [name, setName] = useState(exam?.name ?? '')
  const [style, setStyle] = useState<Exam['style']>(exam?.style ?? 'multiple')
  const [board, setBoard] = useState(exam?.board ?? '')
  const [time, setTime] = useState(fmtClock(exam?.timeSpent ?? 0))
  const [comment, setComment] = useState(exam?.comment ?? '')
  const [rows, setRows] = useState<ExamRow[]>(
    () =>
      exam?.rows.filter((r) => subjects.some((s) => s.id === r.subjectId)) ??
      subjects.map((s) => ({ subjectId: s.id, weight: 1, total: 0, hits: 0, misses: 0 })),
  )
  const [submitted, setSubmitted] = useState(false)

  const subjectOf = (id: string) => subjects.find((s) => s.id === id)
  const available = subjects.filter((s) => !rows.some((r) => r.subjectId === s.id))
  const invalidRow = (r: ExamRow) => r.hits + r.misses > r.total
  const hasInvalid = rows.some(invalidRow)
  const sum = summarizeExam({ rows, style })

  const patch = (i: number, p: Partial<ExamRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const save = () => {
    setSubmitted(true)
    if (!name.trim() || !date || hasInvalid) return
    saveExam({
      id: exam?.id,
      date,
      name: name.trim(),
      style,
      board: board.trim(),
      timeSpent: parseClock(time),
      rows,
      comment: comment.trim(),
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={exam ? 'Editar simulado' : 'Novo simulado'}
      footer={
        <>
          {submitted && hasInvalid && (
            <span className="mr-auto text-sm text-bad">Acertos + erros não podem passar do total de questões.</span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="label" htmlFor="exam-date">
            Data
          </label>
          <input id="exam-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="lg:col-span-2">
          <label className="label" htmlFor="exam-name">
            Nome
          </label>
          <input
            id="exam-name"
            autoFocus
            className={clsx('field', submitted && !name.trim() && 'border-bad!')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Simulado 01 – Cebraspe"
          />
        </div>
        <div>
          <label className="label" htmlFor="exam-style">
            Estilo de prova
          </label>
          <select id="exam-style" className="field" value={style} onChange={(e) => setStyle(e.target.value as Exam['style'])}>
            {(Object.keys(STYLE_LABEL) as Exam['style'][]).map((k) => (
              <option key={k} value={k}>
                {STYLE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="exam-board">
            Banca
          </label>
          <input id="exam-board" className="field" value={board} onChange={(e) => setBoard(e.target.value)} placeholder="Ex.: FGV" />
        </div>
        <div>
          <label className="label" htmlFor="exam-time">
            Tempo gasto
          </label>
          <input
            id="exam-time"
            className="field tabular"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => setTime(fmtClock(parseClock(time)))}
            placeholder="HH:MM:SS"
          />
        </div>
      </div>

      {style === 'true_false' && (
        <p className="mt-3 text-xs text-muted">No estilo Certo/Errado, cada erro anula um acerto na pontuação.</p>
      )}

      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface-2/60">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-3 py-2 text-left">Disciplina</th>
              <th className="w-20 px-2 py-2">Peso</th>
              <th className="w-24 px-2 py-2">Questões</th>
              <th className="w-24 px-2 py-2 text-ok">Acertos</th>
              <th className="w-24 px-2 py-2 text-bad">Erros</th>
              <th className="w-20 px-2 py-2">Brancos</th>
              <th className="w-16 px-2 py-2">%</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = subjectOf(r.subjectId)
              const bad = invalidRow(r)
              return (
                <tr key={r.subjectId} className={clsx('border-t border-line', bad && 'bg-bad/5')}>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <ColorDot color={s?.color ?? '#ccc'} />
                      <span className="font-medium">{s?.name ?? 'Disciplina removida'}</span>
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className="field px-2! py-1! text-center"
                      value={r.weight}
                      onChange={(e) => patch(i, { weight: num(e.target.value) })}
                      aria-label="Peso"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      className="field px-2! py-1! text-center"
                      value={r.total}
                      onChange={(e) => patch(i, { total: int(e.target.value) })}
                      aria-label="Questões"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      className={clsx('field px-2! py-1! text-center', bad && 'border-bad!')}
                      value={r.hits}
                      onChange={(e) => patch(i, { hits: int(e.target.value) })}
                      aria-label="Acertos"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      className={clsx('field px-2! py-1! text-center', bad && 'border-bad!')}
                      value={r.misses}
                      onChange={(e) => patch(i, { misses: int(e.target.value) })}
                      aria-label="Erros"
                    />
                  </td>
                  <td className={clsx('px-2 py-1.5 text-center tabular', bad ? 'text-bad' : 'text-muted')}>
                    {r.total - r.hits - r.misses}
                  </td>
                  <td className="px-2 py-1.5 text-center font-semibold tabular">{pct(r.hits, r.total)}%</td>
                  <td className="px-2 py-1.5 text-center">
                    <IconButton title="Remover disciplina" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                      <X size={15} />
                    </IconButton>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">
                  {subjects.length ? 'Adicione ao menos uma disciplina.' : 'Cadastre disciplinas no plano para lançar o simulado.'}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            {available.length > 0 && (
              <tr className="border-t border-line">
                <td colSpan={8} className="px-3 py-2">
                  <select
                    className="field w-auto! py-1.5!"
                    value=""
                    onChange={(e) =>
                      e.target.value &&
                      setRows((rs) => [...rs, { subjectId: e.target.value, weight: 1, total: 0, hits: 0, misses: 0 }])
                    }
                    aria-label="Adicionar disciplina"
                  >
                    <option value="">+ Adicionar disciplina</option>
                    {available.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-line bg-surface-2/60 font-semibold">
              <td className="px-3 py-2.5 text-xs uppercase tracking-wide">Resultado</td>
              <td className="px-2 py-2.5" />
              <td className="px-2 py-2.5 text-center tabular">{sum.total}</td>
              <td className="px-2 py-2.5 text-center text-ok tabular">{sum.hits}</td>
              <td className="px-2 py-2.5 text-center text-bad tabular">{sum.misses}</td>
              <td className="px-2 py-2.5 text-center tabular">{sum.blanks}</td>
              <td className="px-2 py-2.5 text-center tabular">{sum.performance}%</td>
              <td />
            </tr>
            <tr className="bg-surface-2/60">
              <td colSpan={8} className="px-3 pb-2.5 text-sm">
                Pontuação ponderada:{' '}
                <span className="font-semibold tabular">
                  {fmtNum(sum.score)} de {fmtNum(sum.maxScore)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="exam-comment">
          Comentários
        </label>
        <textarea id="exam-comment" rows={3} className="field" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
    </Modal>
  )
}
