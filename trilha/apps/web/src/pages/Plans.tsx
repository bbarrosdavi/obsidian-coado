import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Briefcase, Building2, CalendarDays, Check, FileText, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, IconButton, Modal, confirmAction } from '../components/ui'
import { stripBullet } from '../components/subjects/stats'
import { useStore } from '../lib/store'
import type { Plan, PlanKind } from '../lib/types'
import { kindOf, PLAN_KINDS, termosDe } from '../lib/modo'
import { clsx, fmtDate, SUBJECT_COLORS, toDateStr, today } from '../lib/utils'

interface ParsedSubject {
  name: string
  topics: string[]
}

/**
 * Converte um edital colado em texto: linhas sem recuo são disciplinas;
 * linhas iniciadas por "-", "•" ou com recuo são tópicos da disciplina anterior.
 */
function parseOutline(text: string): ParsedSubject[] {
  const out: ParsedSubject[] = []
  for (const raw of text.split(/\r?\n/)) {
    const name = stripBullet(raw)
    if (!name) continue
    const isTopic = /^\s/.test(raw) || /^[-•*–]/.test(raw)
    if (isTopic && out.length) out[out.length - 1].topics.push(name)
    else out.push({ name, topics: [] })
  }
  return out
}

export default function PlansPage() {
  const { state, plan: active, setActivePlan, deletePlan } = useStore()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, { subjects: number; topics: number }>()
    const subjectPlan = new Map<string, string>()
    for (const s of state.subjects) {
      if (s.archived) continue
      subjectPlan.set(s.id, s.planId)
      const c = map.get(s.planId) ?? { subjects: 0, topics: 0 }
      c.subjects++
      map.set(s.planId, c)
    }
    for (const t of state.topics) {
      const pid = subjectPlan.get(t.subjectId)
      if (pid) map.get(pid)!.topics++
    }
    return map
  }, [state.subjects, state.topics])

  const remove = (p: Plan) => {
    if (
      confirmAction(
        `Excluir o plano "${p.name}"?\n\nTodas as disciplinas, tópicos, estudos, revisões, planejamento, avaliações e simulados deste plano serão apagados permanentemente.`,
      )
    ) {
      deletePlan(p.id)
    }
  }

  return (
    <>
      <PageHeader title="Planos" hidePlan />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {state.plans.map((p) => {
          const isActive = p.id === active?.id
          const c = counts.get(p.id) ?? { subjects: 0, topics: 0 }
          const uni = kindOf(p) === 'universidade'
          const nextAssessment = uni ? state.assessments.filter((a) => a.planId === p.id && !a.done && a.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0] : undefined
          return (
            <article
              key={p.id}
              className={clsx(
                'flex flex-col rounded-2xl border bg-surface p-5 shadow-sm transition',
                isActive ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-line',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {isActive && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                      <Check size={12} /> Ativo
                    </span>
                  )}
                  <h2 className="text-lg font-semibold leading-snug">{p.name}</h2>
                  {uni && <p className="text-xs font-medium text-muted">Universidade ou escola</p>}
                </div>
                <IconButton title="Editar plano" onClick={() => setEditing(p)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton title="Excluir plano" onClick={() => remove(p)} className="hover:text-bad">
                  <Trash2 size={15} />
                </IconButton>
              </div>

              <div className="mt-2 space-y-1 text-sm text-muted">
                {p.org && <InfoLine icon={<Building2 size={14} />}>{p.org}</InfoLine>}
                {p.role && <InfoLine icon={<Briefcase size={14} />}>{p.role}</InfoLine>}
                {!uni && p.examDate && <InfoLine icon={<CalendarDays size={14} />}>Prova em {fmtDate(p.examDate)}</InfoLine>}
                {nextAssessment && (
                  <InfoLine icon={<CalendarDays size={14} />}>
                    {nextAssessment.name} em {fmtDate(nextAssessment.date)}
                  </InfoLine>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Count icon={<BookOpen size={14} />} label="Disciplinas" value={c.subjects} />
                <Count icon={<ListChecks size={14} />} label="Tópicos" value={c.topics} />
              </div>

              {p.notes && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm text-muted">{p.notes}</p>}

              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <span className="text-xs text-muted">Criado em {fmtDate(toDateStr(new Date(p.createdAt)))}</span>
                {isActive ? (
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-300">Plano em uso</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setActivePlan(p.id)}>
                    Usar este plano
                  </Button>
                )}
              </div>
            </article>
          )
        })}

        <button
          onClick={() => setEditing('new')}
          className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line p-5 text-muted transition hover:border-brand-400 hover:bg-surface hover:text-brand-600"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
            <Plus size={24} />
          </span>
          <span className="font-medium">Criar novo plano</span>
          {state.plans.length === 0 && <span className="max-w-xs text-center text-sm">Comece criando um plano para o seu concurso ou semestre.</span>}
        </button>
      </div>

      {editing && <PlanModal plan={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5">
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </p>
  )
}

function Count({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="text-xl font-semibold tabular">{value}</div>
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        {icon} {label}
      </div>
    </div>
  )
}

function PlanModal({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const { savePlan, setActivePlan, saveSubject, saveTopic } = useStore()
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    kind: kindOf(plan) as PlanKind,
    org: plan?.org ?? '',
    role: plan?.role ?? '',
    notes: plan?.notes ?? '',
    examDate: plan?.examDate ?? '',
    hours: plan ? Math.round((plan.weeklyGoal.minutes / 60) * 10) / 10 : 0,
    questions: plan?.weeklyGoal.questions ?? 0,
  })
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)

  const parsed = useMemo(() => (showImport ? parseOutline(importText) : []), [showImport, importText])
  const parsedTopics = parsed.reduce((a, s) => a + s.topics.length, 0)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const termos = termosDe(form.kind)

  const save = () => {
    const name = form.name.trim()
    if (!name) return
    const id = savePlan({
      id: plan?.id,
      name,
      // concurso fica sem campo, como nas contas antigas
      kind: form.kind === 'universidade' ? 'universidade' : undefined,
      org: form.org.trim() || undefined,
      role: form.role.trim() || undefined,
      notes: form.notes.trim() || undefined,
      examDate: (!termos.universidade && form.examDate) || undefined,
      weeklyGoal: { minutes: Math.round(Math.max(0, form.hours) * 60), questions: Math.max(0, Math.round(form.questions)) },
    })
    if (!plan) {
      setActivePlan(id)
      parsed.forEach((s, i) => {
        const subjectId = saveSubject({ name: s.name, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length], planId: id, order: i })
        s.topics.forEach((t, j) => saveTopic({ name: t, subjectId, order: j + 1 }))
      })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={plan ? 'Editar plano' : 'Novo plano'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!form.name.trim()}>
            {plan ? 'Salvar' : 'Criar plano'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="label">Tipo</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLAN_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => set('kind', k.value)}
                className={clsx(
                  'rounded-xl border p-3 text-left transition',
                  form.kind === k.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/15' : 'border-line hover:bg-surface-2',
                )}
              >
                <span className="block text-sm font-semibold">{k.label}</span>
                <span className="block text-xs text-muted">{k.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="plan-name">
            Nome *
          </label>
          <input
            id="plan-name"
            autoFocus
            className="field"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={termos.universidade ? 'Ex.: Engenharia, 2026/2' : 'Ex.: Petrobras 2026, Técnico'}
          />
        </div>
        <div>
          <label className="label" htmlFor="plan-org">
            {termos.org}
          </label>
          <input id="plan-org" className="field" value={form.org} onChange={(e) => set('org', e.target.value)} placeholder={termos.universidade ? 'Ex.: UTFPR' : 'Ex.: Petrobras'} />
        </div>
        <div>
          <label className="label" htmlFor="plan-role">
            {termos.role}
          </label>
          <input
            id="plan-role"
            className="field"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            placeholder={termos.universidade ? 'Ex.: Engenharia Eletrônica' : 'Ex.: Técnico de Administração'}
          />
        </div>
        {!termos.universidade && (
          <div>
            <label className="label" htmlFor="plan-exam">
              Data da prova
            </label>
            <input id="plan-exam" type="date" className="field" value={form.examDate} onChange={(e) => set('examDate', e.target.value)} />
          </div>
        )}
        <div>
          <span className="label">Meta semanal</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="number"
                min={0}
                step={0.5}
                className="field pr-10!"
                value={form.hours}
                onChange={(e) => set('hours', Number(e.target.value) || 0)}
                aria-label="Horas por semana"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">h</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min={0}
                step={10}
                className="field pr-16!"
                value={form.questions}
                onChange={(e) => set('questions', Number(e.target.value) || 0)}
                aria-label="Questões por semana"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">questões</span>
            </div>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="plan-notes">
            Observações
          </label>
          <textarea id="plan-notes" rows={3} className="field" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {!plan && (
          <div className="rounded-xl border border-line bg-surface-2/50 p-4 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4" checked={showImport} onChange={(e) => setShowImport(e.target.checked)} />
              <FileText size={16} className="text-muted" /> Importar disciplinas e tópicos de texto
            </label>
            {showImport && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted">
                  Cole o conteúdo do {termos.edital.toLowerCase()}: cada linha sem recuo vira uma disciplina; linhas iniciadas por “-”, “•” ou com recuo
                  viram tópicos da disciplina acima.
                </p>
                <textarea
                  rows={10}
                  className="field font-mono text-xs!"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={'Língua Portuguesa\n- Compreensão de textos\n- Ortografia\nMatemática\n  Porcentagem\n  Juros simples'}
                />
                <p className="text-xs font-medium">
                  {parsed.length} disciplina(s) e {parsedTopics} tópico(s) serão criados.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
