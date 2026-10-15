import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Briefcase, Building2, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, Empty, IconButton, Modal, ProgressBar, confirmAction } from '../components/ui'
import { ColorPicker } from '../components/subjects/ColorPicker'
import { NoPlan } from '../components/subjects/NoPlan'
import { TopicManager } from '../components/subjects/TopicManager'
import { statsBy } from '../components/subjects/stats'
import { useStore } from '../lib/store'
import type { ID, Subject } from '../lib/types'
import { fmtDuration, pct, SUBJECT_COLORS, totals } from '../lib/utils'

export default function SubjectsPage() {
  const { plan, subjects, studies, topicsOf, deleteSubject } = useStore()
  const [editing, setEditing] = useState<Subject | 'new' | null>(null)
  const [managing, setManaging] = useState<ID | null>(null)

  const sum = useMemo(() => totals(studies), [studies])
  const bySubject = useMemo(() => statsBy(studies, (s) => s.subjectId), [studies])

  if (!plan) {
    return (
      <>
        <PageHeader title="Disciplinas" />
        <NoPlan />
      </>
    )
  }

  const topicCount = subjects.reduce((a, s) => a + topicsOf(s.id).length, 0)
  const managed = subjects.find((s) => s.id === managing)

  const remove = (s: Subject) => {
    if (confirmAction(`Excluir a disciplina "${s.name}"? Todos os tópicos, estudos e revisões dela também serão apagados.`)) {
      deleteSubject(s.id)
    }
  }

  return (
    <>
      <PageHeader title="Disciplinas" />

      <Card className="mb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {plan.org && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={14} /> {plan.org}
                </span>
              )}
              {plan.role && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={14} /> {plan.role}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={14} /> {subjects.length} disciplinas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks size={14} /> {topicCount} tópicos
              </span>
            </div>
            {plan.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted">{plan.notes}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[28rem]">
            <Summary label="Horas estudadas" value={fmtDuration(sum.duration)} />
            <Summary label="Questões realizadas" value={sum.questions} />
            <Summary label="Desempenho" value={`${sum.performance}%`} />
          </div>
        </div>
      </Card>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{subjects.length} disciplinas</h2>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} /> Nova disciplina
        </Button>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <Empty
            icon={<BookOpen size={36} />}
            title="Nenhuma disciplina cadastrada"
            action={
              <Button onClick={() => setEditing('new')}>
                <Plus size={16} /> Nova disciplina
              </Button>
            }
          >
            Cadastre as disciplinas do seu plano para organizar tópicos e registrar estudos.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => {
            const topics = topicsOf(s.id)
            const done = topics.filter((t) => t.finished).length
            const st = bySubject.get(s.id)
            const progress = pct(done, topics.length)
            return (
              <article key={s.id} className="flex overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <div className="w-1.5 shrink-0" style={{ background: s.color }} />
                <div className="flex min-w-0 flex-1 flex-col p-5">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 font-semibold leading-snug">{s.name}</h3>
                    <IconButton title="Editar disciplina" onClick={() => setEditing(s)}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton title="Excluir disciplina" onClick={() => remove(s)} className="hover:text-bad">
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Metric label="Tópicos" value={`${done}/${topics.length}`} />
                    <Metric label="Questões" value={(st?.hits ?? 0) + (st?.misses ?? 0)} />
                    <Metric label="Tempo" value={fmtDuration(st?.duration ?? 0)} />
                  </dl>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={progress} />
                    <span className="w-10 shrink-0 text-right text-xs font-semibold tabular">{progress}%</span>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setManaging(s.id)}>
                    <ListChecks size={14} /> Ver tópicos
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing && <SubjectModal subject={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {managed && <TopicManager subject={managed} onClose={() => setManaging(null)} />}
    </>
  )
}

function Summary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3 text-center">
      <div className="text-lg font-semibold tabular sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <dd className="text-sm font-semibold tabular">{value}</dd>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</dt>
    </div>
  )
}

function SubjectModal({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const { subjects, saveSubject } = useStore()
  const [name, setName] = useState(subject?.name ?? '')
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length])

  const save = () => {
    if (!name.trim()) return
    saveSubject({ id: subject?.id, name: name.trim(), color })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={subject ? 'Editar disciplina' : 'Nova disciplina'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="subject-name">
            Nome
          </label>
          <input
            id="subject-name"
            autoFocus
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Ex.: Língua Portuguesa"
          />
        </div>
        <div>
          <span className="label">Cor</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
    </Modal>
  )
}
