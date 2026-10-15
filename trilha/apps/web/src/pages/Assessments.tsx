import { useMemo, useState } from 'react'
import { Check, ClipboardCheck, MessageSquare, Pencil, PencilLine, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, ColorDot, Empty, IconButton, confirmAction } from '../components/ui'
import { AssessmentModal } from '../components/assessments/AssessmentModal'
import { DateBadge } from '../components/home/DateBadge'
import { NoPlan } from '../components/subjects/NoPlan'
import { assessmentKindLabel, quando } from '../lib/modo'
import { useStore } from '../lib/store'
import type { Assessment, Study, Subject } from '../lib/types'
import { clsx, fmtDuration, today } from '../lib/utils'

export default function AssessmentsPage() {
  const { plan, assessments, studies, subjects, state } = useStore()
  const [editing, setEditing] = useState<Assessment | 'new' | null>(null)

  const subjectMap = useMemo(() => new Map<string, Subject>(state.subjects.map((s) => [s.id, s])), [state.subjects])
  const pending = assessments.filter((a) => !a.done)
  const done = assessments.filter((a) => a.done).reverse()

  const header = (
    <PageHeader title="Avaliações">
      {plan && (
        <Button variant="secondary" onClick={() => setEditing('new')} disabled={subjects.length === 0}>
          <Plus size={16} /> Nova avaliação
        </Button>
      )}
    </PageHeader>
  )

  if (!plan) {
    return (
      <>
        {header}
        <NoPlan />
      </>
    )
  }

  return (
    <>
      {header}

      {assessments.length === 0 ? (
        <Card>
          <Empty
            icon={<ClipboardCheck size={36} />}
            title="Nenhuma avaliação cadastrada"
            action={
              subjects.length > 0 && (
                <Button onClick={() => setEditing('new')}>
                  <Plus size={16} /> Nova avaliação
                </Button>
              )
            }
          >
            {subjects.length > 0
              ? 'Cadastre provas, trabalhos e listas de cada disciplina para ver o que vem pela frente e quanto estudou para cada uma.'
              : 'Cadastre as disciplinas do semestre primeiro.'}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <Card title={`Pela frente (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nada pendente.</p>
            ) : (
              <ul className="-my-1 divide-y divide-line">
                {pending.map((a) => (
                  <AssessmentRow key={a.id} a={a} subject={subjectMap.get(a.subjectId)} studies={studies} onEdit={() => setEditing(a)} />
                ))}
              </ul>
            )}
          </Card>
          <Card title={`Feitas (${done.length})`}>
            {done.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhuma ainda.</p>
            ) : (
              <ul className="-my-1 divide-y divide-line">
                {done.map((a) => (
                  <AssessmentRow key={a.id} a={a} subject={subjectMap.get(a.subjectId)} studies={studies} onEdit={() => setEditing(a)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {editing && <AssessmentModal assessment={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function AssessmentRow({ a, subject, studies, onEdit }: { a: Assessment; subject?: Subject; studies: Study[]; onEdit: () => void }) {
  const { saveAssessment, deleteAssessment, openStudy } = useStore()
  const studied = studies.filter((s) => s.assessmentId === a.id).reduce((t, s) => t + s.duration, 0)
  const late = !a.done && a.date < today()
  const meta = [assessmentKindLabel(a.kind), a.time, a.weight && `peso ${a.weight}`, studied > 0 && `${fmtDuration(studied)} de estudo`].filter(
    Boolean,
  )

  const remove = () => {
    if (confirmAction(`Excluir a avaliação "${a.name}"? Os estudos ligados a ela continuam no histórico.`)) deleteAssessment(a.id)
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      <DateBadge date={a.date} className={clsx(a.done && 'opacity-60')} />
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ColorDot color={subject?.color ?? '#ccc'} />
          <span className="truncate">{subject?.name ?? 'Disciplina removida'}</span>
        </p>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{a.name}</span>
          {a.notes && (
            <span title={a.notes} className="shrink-0 text-muted">
              <MessageSquare size={13} />
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted">{meta.join(' · ')}</p>
      </div>
      {/* em tela estreita, prazo e ações descem para a linha de baixo */}
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <div className="shrink-0 text-right">
          {a.done ? (
            a.grade !== undefined && (
              <p className="text-sm font-semibold tabular">
                {a.grade.toLocaleString('pt-BR')}
                {a.maxGrade !== undefined && <span className="text-xs font-normal text-muted">/{a.maxGrade.toLocaleString('pt-BR')}</span>}
              </p>
            )
          ) : (
            <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-semibold', late ? 'bg-bad/10 text-bad' : 'bg-surface-2 text-muted')}>
              {late ? `atrasada, ${quando(a.date)}` : quando(a.date)}
            </span>
          )}
        </div>
        <div className="flex shrink-0">
          {!a.done && (
            <IconButton title="Registrar estudo para esta avaliação" onClick={() => openStudy({ subjectId: a.subjectId, assessmentId: a.id })}>
              <PencilLine size={15} />
            </IconButton>
          )}
          <IconButton
            title={a.done ? 'Voltar para pendente' : a.kind === 'prova' ? 'Marcar como feita' : 'Marcar como entregue'}
            onClick={() => saveAssessment({ ...a, done: !a.done })}
            className={a.done ? undefined : 'hover:text-ok'}
          >
            {a.done ? <RotateCcw size={15} /> : <Check size={15} />}
          </IconButton>
          <IconButton title="Editar avaliação" onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          <IconButton title="Excluir avaliação" onClick={remove} className="hover:text-bad">
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
    </li>
  )
}
