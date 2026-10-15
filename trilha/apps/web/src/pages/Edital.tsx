import { useMemo, useState } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Link2, ListChecks, Plus } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, Empty, IconButton, ProgressBar, QuestionStats } from '../components/ui'
import { LinksModal } from '../components/subjects/LinksEditor'
import { NoPlan } from '../components/subjects/NoPlan'
import { emptyStat, statsBy, type StudyStat } from '../components/subjects/stats'
import { useStore } from '../lib/store'
import { useTermos } from '../lib/modo'
import type { ID, Subject } from '../lib/types'
import { clsx, fmtDate, pct } from '../lib/utils'

export default function EditalPage() {
  const { plan, subjects, studies, topicsOf } = useStore()
  const [open, setOpen] = useState<Set<ID>>(() => new Set())
  const [hideDone, setHideDone] = useState(false)
  const [linksOf, setLinksOf] = useState<ID | null>(null)
  const termos = useTermos()

  const byTopic = useMemo(() => statsBy(studies, (s) => s.topicId), [studies])
  const bySubject = useMemo(() => statsBy(studies, (s) => s.subjectId), [studies])
  const noTopic = useMemo(() => statsBy(studies, (s) => (s.topicId ? undefined : s.subjectId)), [studies])

  if (!plan) {
    return (
      <>
        <PageHeader title={termos.editalTitulo} />
        <NoPlan />
      </>
    )
  }

  const allTopics = subjects.flatMap((s) => topicsOf(s.id))
  const doneCount = allTopics.filter((t) => t.finished).length
  const allOpen = subjects.length > 0 && subjects.every((s) => open.has(s.id))

  const toggle = (id: ID) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <>
      <PageHeader title={termos.editalTitulo} />

      <Card title={termos.progresso} className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-lg">
            <span className="font-semibold tabular">{doneCount}</span> de <span className="font-semibold tabular">{allTopics.length}</span>{' '}
            tópicos concluídos
          </p>
          <span className="text-3xl font-semibold tabular text-brand-600 dark:text-brand-300">{pct(doneCount, allTopics.length)}%</span>
        </div>
        <ProgressBar value={pct(doneCount, allTopics.length)} className="mt-3 h-3" />
      </Card>

      {subjects.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks size={36} />} title="Nenhuma disciplina neste plano">
            Cadastre disciplinas e tópicos na página Disciplinas para acompanhar o {termos.edital.toLowerCase()}.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="h-4 w-4" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
              Ocultar concluídos
            </label>
            <Button variant="secondary" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(subjects.map((s) => s.id)))}>
              {allOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
              {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
            </Button>
          </div>

          <div className="space-y-3">
            {subjects.map((s) => (
              <SubjectBlock
                key={s.id}
                subject={s}
                expanded={open.has(s.id)}
                onToggle={() => toggle(s.id)}
                hideDone={hideDone}
                stat={bySubject.get(s.id) ?? emptyStat()}
                noTopicStat={noTopic.get(s.id)}
                byTopic={byTopic}
                onLinks={setLinksOf}
              />
            ))}
          </div>
        </>
      )}

      {linksOf && <LinksModal topicId={linksOf} onClose={() => setLinksOf(null)} />}
    </>
  )
}

function SubjectBlock({
  subject,
  expanded,
  onToggle,
  hideDone,
  stat,
  noTopicStat,
  byTopic,
  onLinks,
}: {
  subject: Subject
  expanded: boolean
  onToggle: () => void
  hideDone: boolean
  stat: StudyStat
  noTopicStat?: StudyStat
  byTopic: Map<ID, StudyStat>
  onLinks: (topicId: ID) => void
}) {
  const { topicsOf, setTopicFinished, openStudy } = useStore()
  const topics = topicsOf(subject.id)
  const done = topics.filter((t) => t.finished).length
  const progress = pct(done, topics.length)
  const visible = hideDone ? topics.filter((t) => !t.finished) : topics
  const total = stat.hits + stat.misses

  return (
    <section className="flex overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="w-1.5 shrink-0" style={{ background: subject.color }} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition hover:bg-surface-2/60 sm:px-5"
        >
          <span className="min-w-0 flex-1 basis-48 font-semibold">{subject.name}</span>
          <QuestionStats hits={stat.hits} misses={stat.misses} />
          <span className="flex w-full items-center gap-2 sm:w-48">
            <ProgressBar value={progress} />
            <span className="w-16 shrink-0 text-right text-xs text-muted tabular">
              {done}/{topics.length} · {progress}%
            </span>
          </span>
          <ChevronDown size={18} className={clsx('shrink-0 text-muted transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 text-left sm:px-5">Tópico</th>
                  <th className="w-14 px-2 py-2 text-center text-ok" title="Acertos">
                    ✓
                  </th>
                  <th className="w-14 px-2 py-2 text-center text-bad" title="Erros">
                    ✗
                  </th>
                  <th className="w-14 px-2 py-2 text-center">Total</th>
                  <th className="w-14 px-2 py-2 text-center">%</th>
                  <th className="w-28 px-2 py-2 text-center">Último estudo</th>
                  <th className="w-20 px-2 py-2 text-center">Estudos</th>
                  <th className="w-16 px-2 py-2 text-center">Links</th>
                  <th className="w-12 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const st = byTopic.get(t.id)
                  const q = (st?.hits ?? 0) + (st?.misses ?? 0)
                  return (
                    <tr key={t.id} className="border-t border-line hover:bg-surface-2/40">
                      <td className="px-4 py-2 sm:px-5">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0"
                            checked={t.finished}
                            onChange={(e) => setTopicFinished(t.id, e.target.checked)}
                          />
                          <span className={clsx('text-xs font-medium uppercase leading-snug', t.finished && 'text-muted line-through')}>{t.name}</span>
                        </label>
                      </td>
                      <td className="px-2 py-2 text-center text-ok tabular">{st?.hits ?? 0}</td>
                      <td className="px-2 py-2 text-center text-bad tabular">{st?.misses ?? 0}</td>
                      <td className="px-2 py-2 text-center tabular">{q}</td>
                      <td className="px-2 py-2 text-center font-semibold tabular">{q ? `${pct(st!.hits, q)}%` : '-'}</td>
                      <td className="px-2 py-2 text-center text-muted tabular">{st?.last ? fmtDate(st.last) : '-'}</td>
                      <td className="px-2 py-2 text-center tabular">{st?.count ?? 0}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => onLinks(t.id)}
                          title="Ver ou adicionar links"
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition hover:bg-surface-2 hover:text-ink',
                            t.links.length ? 'text-brand-600 dark:text-brand-300' : 'text-muted',
                          )}
                        >
                          <Link2 size={13} /> {t.links.length}
                        </button>
                      </td>
                      <td className="px-2 py-1 text-center">
                        <IconButton title="Registrar estudo deste tópico" onClick={() => openStudy({ subjectId: subject.id, topicId: t.id })}>
                          <Plus size={16} />
                        </IconButton>
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr className="border-t border-line">
                    <td colSpan={9} className="px-5 py-4 text-center text-sm text-muted">
                      {topics.length === 0 ? 'Nenhum tópico cadastrado nesta disciplina.' : 'Todos os tópicos foram concluídos.'}
                    </td>
                  </tr>
                )}
                {noTopicStat && (
                  <tr className="border-t border-line text-muted">
                    <td className="px-4 py-2 text-xs italic sm:px-5">Estudos sem tópico</td>
                    <td className="px-2 py-2 text-center tabular">{noTopicStat.hits}</td>
                    <td className="px-2 py-2 text-center tabular">{noTopicStat.misses}</td>
                    <td className="px-2 py-2 text-center tabular">{noTopicStat.hits + noTopicStat.misses}</td>
                    <td className="px-2 py-2 text-center tabular">
                      {noTopicStat.hits + noTopicStat.misses ? `${pct(noTopicStat.hits, noTopicStat.hits + noTopicStat.misses)}%` : '-'}
                    </td>
                    <td className="px-2 py-2 text-center tabular">{noTopicStat.last ? fmtDate(noTopicStat.last) : '-'}</td>
                    <td className="px-2 py-2 text-center tabular">{noTopicStat.count}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold">
                  <td className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-wide">Total</span>
                      <ProgressBar value={progress} className="max-w-40" />
                      <span className="shrink-0 text-xs font-normal text-muted tabular">
                        {done}/{topics.length} concluídos · {progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-ok tabular">{stat.hits}</td>
                  <td className="px-2 py-2.5 text-center text-bad tabular">{stat.misses}</td>
                  <td className="px-2 py-2.5 text-center tabular">{total}</td>
                  <td className="px-2 py-2.5 text-center tabular">{total ? `${pct(stat.hits, total)}%` : '-'}</td>
                  <td className="px-2 py-2.5 text-center text-muted tabular">{stat.last ? fmtDate(stat.last) : '-'}</td>
                  <td className="px-2 py-2.5 text-center tabular">{stat.count}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
