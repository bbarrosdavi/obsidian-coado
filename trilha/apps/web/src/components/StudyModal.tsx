import { useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore, type StudyDraft } from '../lib/store'
import type { PageRange, VideoRange } from '../lib/types'
import { addDays, clsx, fmtClock, parseClock, today, SUBJECT_COLORS } from '../lib/utils'
import { Button, Modal } from './ui'
import { assessmentKindLabel, useTermos } from '../lib/modo'

interface Form {
  dateMode: 'today' | 'yesterday' | 'other'
  date: string
  categoryId: string
  subjectId: string
  topicId: string
  assessmentId: string
  duration: string
  material: string
  finishTopic: boolean
  countInPlanning: boolean
  scheduleReviews: boolean
  intervals: number[]
  hits: number
  misses: number
  pages: PageRange[]
  videos: { title: string; start: string; end: string }[]
  comment: string
}

const NEW = '__new__'

export function StudyModal() {
  const { studyDraft, closeStudy } = useStore()
  if (!studyDraft) return null
  return <StudyForm key={JSON.stringify(studyDraft)} draft={studyDraft} onClose={closeStudy} />
}

function StudyForm({ draft, onClose }: { draft: StudyDraft; onClose: () => void }) {
  const store = useStore()
  const { state, subjects, topicsOf, assessments, saveStudy, saveSubject, saveTopic, addCategory, setReviewStatus } = store
  const termos = useTermos()
  const editing = draft.editingId ? state.studies.find((s) => s.id === draft.editingId) : undefined

  const initial = (): Form => {
    const date = draft.date ?? today()
    return {
      dateMode: date === today() ? 'today' : date === addDays(today(), -1) ? 'yesterday' : 'other',
      date,
      categoryId: draft.categoryId ?? '',
      subjectId: draft.subjectId ?? '',
      topicId: draft.topicId ?? '',
      assessmentId: draft.assessmentId ?? '',
      duration: fmtClock(draft.duration ?? 0),
      material: draft.material ?? '',
      finishTopic: draft.finishTopic ?? false,
      countInPlanning: draft.countInPlanning ?? true,
      scheduleReviews: !editing && (draft.reviewIntervals?.length ?? 0) > 0,
      intervals: draft.reviewIntervals?.length ? draft.reviewIntervals : state.reviewIntervals,
      hits: draft.hits ?? 0,
      misses: draft.misses ?? 0,
      pages: draft.pages?.length ? draft.pages : [{ start: 0, end: 0 }],
      videos: draft.videos?.length
        ? draft.videos.map((v) => ({ title: v.title, start: fmtClock(v.start), end: fmtClock(v.end) }))
        : [{ title: '', start: '00:00:00', end: '00:00:00' }],
      comment: draft.comment ?? '',
    }
  }

  const [f, setF] = useState<Form>(initial)
  const [saveAndNew, setSaveAndNew] = useState(false)
  const [newInterval, setNewInterval] = useState('')
  const [error, setError] = useState('')
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => setError(''), [f.subjectId, f.categoryId, f.duration])

  const topics = f.subjectId ? topicsOf(f.subjectId) : []
  // pendentes da disciplina, mais a já ligada (que pode estar feita)
  const subjectAssessments = assessments.filter((a) => a.subjectId === f.subjectId && (!a.done || a.id === f.assessmentId))
  const showAssessment = termos.universidade && subjectAssessments.length > 0

  const pickDateMode = (mode: Form['dateMode']) => {
    if (mode === 'today') setF((p) => ({ ...p, dateMode: mode, date: today() }))
    else if (mode === 'yesterday') setF((p) => ({ ...p, dateMode: mode, date: addDays(today(), -1) }))
    else set('dateMode', mode)
  }

  const onCategory = (v: string) => {
    if (v !== NEW) return set('categoryId', v)
    const name = window.prompt('Nome da nova categoria')?.trim()
    if (name) set('categoryId', addCategory(name).id)
  }

  const onSubject = (v: string) => {
    if (v !== NEW) return setF((p) => ({ ...p, subjectId: v, topicId: '', assessmentId: '' }))
    const name = window.prompt('Nome da nova disciplina')?.trim()
    if (!name) return
    const id = saveSubject({ name, color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length] })
    setF((p) => ({ ...p, subjectId: id, topicId: '', assessmentId: '' }))
  }

  const onTopic = (v: string) => {
    if (v !== NEW) return set('topicId', v)
    const name = window.prompt('Nome do novo tópico')?.trim()
    if (name) set('topicId', saveTopic({ name, subjectId: f.subjectId }))
  }

  const submit = () => {
    const duration = parseClock(f.duration)
    if (!f.categoryId) return setError('Selecione a categoria.')
    if (!f.subjectId) return setError('Selecione a disciplina.')
    if (duration <= 0) return setError('Informe o tempo de estudo.')
    const videos: VideoRange[] = f.videos
      .map((v) => ({ title: v.title.trim(), start: parseClock(v.start), end: parseClock(v.end) }))
      .filter((v) => v.end > v.start)
    saveStudy(
      {
        date: f.date,
        time: editing?.time,
        categoryId: f.categoryId,
        subjectId: f.subjectId,
        topicId: f.topicId || undefined,
        assessmentId: (showAssessment && f.assessmentId) || undefined,
        duration,
        material: f.material.trim(),
        hits: Math.max(0, f.hits),
        misses: Math.max(0, f.misses),
        pages: f.pages.filter((p) => p.end > p.start),
        videos,
        comment: f.comment.trim(),
        countInPlanning: f.countInPlanning,
        finishTopic: f.finishTopic,
        reviewIntervals: f.scheduleReviews ? f.intervals : [],
      },
      draft.editingId,
    )
    if (draft.reviewId) setReviewStatus(draft.reviewId, 'done')
    if (saveAndNew) {
      setF({ ...initial(), subjectId: f.subjectId, categoryId: f.categoryId, date: f.date, dateMode: f.dateMode, duration: '00:00:00' })
    } else onClose()
  }

  const addInterval = () => {
    const n = Number(newInterval)
    if (n > 0 && !f.intervals.includes(n)) set('intervals', [...f.intervals, n].sort((a, b) => a - b))
    setNewInterval('')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar estudo' : 'Registrar estudo'}
      size="lg"
      footer={
        <>
          {!editing && (
            <label className="mr-auto flex items-center gap-2 text-xs font-medium uppercase text-muted">
              <input type="checkbox" checked={saveAndNew} onChange={(e) => setSaveAndNew(e.target.checked)} />
              Salvar e criar novo
            </label>
          )}
          {error && <span className="text-sm text-bad">{error}</span>}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* data */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['today', 'Hoje'],
              ['yesterday', 'Ontem'],
              ['other', 'Outro dia'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => pickDateMode(m)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-semibold',
                f.dateMode === m ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
          {f.dateMode === 'other' && (
            <input type="date" className="field w-auto py-1" value={f.date} max={today()} onChange={(e) => set('date', e.target.value)} />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
          <div>
            <label className="label">Categoria</label>
            <select className="field" value={f.categoryId} onChange={(e) => onCategory(e.target.value)}>
              <option value="">Selecione…</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW}>+ Nova categoria</option>
            </select>
          </div>
          <div>
            <label className="label">Disciplina</label>
            <select className="field" value={f.subjectId} onChange={(e) => onSubject(e.target.value)}>
              <option value="">Selecione…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NEW}>+ Nova disciplina</option>
            </select>
          </div>
          <div>
            <label className="label">Tempo de estudo</label>
            <input className="field tabular" value={f.duration} onChange={(e) => set('duration', e.target.value)} placeholder="01:30:00" />
          </div>
        </div>

        <div className={clsx('grid gap-4', showAssessment ? 'sm:grid-cols-[2fr_2fr_1fr]' : 'sm:grid-cols-[3fr_1fr]')}>
          <div>
            <label className="label">Tópico</label>
            <select className="field" value={f.topicId} disabled={!f.subjectId} onChange={(e) => onTopic(e.target.value)}>
              <option value="">{f.subjectId ? 'Selecione…' : 'Escolha a disciplina primeiro'}</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.finished ? '✓ ' : ''}
                  {t.name}
                </option>
              ))}
              {f.subjectId && <option value={NEW}>+ Novo tópico</option>}
            </select>
          </div>
          {showAssessment && (
            <div>
              <label className="label">Para a avaliação</label>
              <select className="field" value={f.assessmentId} onChange={(e) => set('assessmentId', e.target.value)}>
                <option value="">Nenhuma</option>
                {subjectAssessments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({assessmentKindLabel(a.kind).toLowerCase()}, {a.date.slice(8, 10)}/{a.date.slice(5, 7)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Material</label>
            <input className="field" value={f.material} onChange={(e) => set('material', e.target.value)} placeholder="Ex.: Aula 01" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.finishTopic} disabled={!f.topicId} onChange={(e) => set('finishTopic', e.target.checked)} />
            Teoria finalizada (concluir tópico)
          </label>
          <label className="flex items-center gap-2 text-sm" title="O tempo deste estudo avança o ciclo do planejamento">
            <input type="checkbox" checked={f.countInPlanning} onChange={(e) => set('countInPlanning', e.target.checked)} />
            Contabilizar no planejamento
          </label>
          {!editing && (
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.scheduleReviews} onChange={(e) => set('scheduleReviews', e.target.checked)} />
                Programar revisões
              </label>
              {f.scheduleReviews && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                  {f.intervals.map((i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                      {i}d
                      <button onClick={() => set('intervals', f.intervals.filter((x) => x !== i))} aria-label={`Remover ${i} dias`}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="field w-16 py-0.5 text-xs"
                    placeholder="dias"
                    value={newInterval}
                    onChange={(e) => setNewInterval(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && addInterval()}
                  />
                  <button onClick={addInterval} className="text-brand-600" aria-label="Adicionar intervalo">
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="label px-1">Questões</legend>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-ok">Acertos</span>
                <input type="number" min={0} className="field" value={f.hits} onChange={(e) => set('hits', Number(e.target.value))} />
              </div>
              <div>
                <span className="text-[11px] text-bad">Erros</span>
                <input type="number" min={0} className="field" value={f.misses} onChange={(e) => set('misses', Number(e.target.value))} />
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-line p-3">
            <legend className="label px-1">Páginas (início / fim)</legend>
            <div className="space-y-2">
              {f.pages.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="number" min={0} className="field px-2" value={p.start} onChange={(e) => set('pages', f.pages.map((x, j) => (j === i ? { ...x, start: Number(e.target.value) } : x)))} />
                  <input type="number" min={0} className="field px-2" value={p.end} onChange={(e) => set('pages', f.pages.map((x, j) => (j === i ? { ...x, end: Number(e.target.value) } : x)))} />
                  {f.pages.length > 1 && (
                    <button onClick={() => set('pages', f.pages.filter((_, j) => j !== i))} className="text-muted hover:text-bad" aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => set('pages', [...f.pages, { start: 0, end: 0 }])} className="flex items-center gap-1 text-xs font-medium text-brand-600">
                <Plus size={14} /> intervalo
              </button>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-line p-3">
            <legend className="label px-1">Videoaulas (título / início / fim)</legend>
            <div className="space-y-2">
              {f.videos.map((v, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input className="field px-2" placeholder={`Vídeo ${i + 1}`} value={v.title} onChange={(e) => set('videos', f.videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <input className="field w-24 px-2 tabular" value={v.start} onChange={(e) => set('videos', f.videos.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <input className="field w-24 px-2 tabular" value={v.end} onChange={(e) => set('videos', f.videos.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  {f.videos.length > 1 && (
                    <button onClick={() => set('videos', f.videos.filter((_, j) => j !== i))} className="text-muted hover:text-bad" aria-label="Remover">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => set('videos', [...f.videos, { title: '', start: '00:00:00', end: '00:00:00' }])}
                className="flex items-center gap-1 text-xs font-medium text-brand-600"
              >
                <Plus size={14} /> vídeo
              </button>
            </div>
          </fieldset>
        </div>

        <div>
          <label className="label">Comentários</label>
          <textarea className="field min-h-20" value={f.comment} onChange={(e) => set('comment', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
