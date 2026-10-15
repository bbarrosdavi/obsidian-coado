import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, FolderOpen, History as HistoryIcon, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, Empty, IconButton, QuestionStats, Stat, confirmAction } from '../components/ui'
import { FilterBar } from '../components/charts/FilterBar'
import { applyFilters, categoryName, editDraft, initialFilters, plural, sortRecent, type Filters } from '../components/charts/filters'
import { DateBadge } from '../components/home/DateBadge'
import { useStore } from '../lib/store'
import type { DateStr, Study, Subject } from '../lib/types'
import { fmtClock, fmtDuration, studyPages, totals } from '../lib/utils'

const PAGE_SIZE = 30

function groupByDate(studies: Study[]) {
  const groups: { date: DateStr; items: Study[] }[] = []
  for (const s of studies) {
    const last = groups[groups.length - 1]
    if (last?.date === s.date) last.items.push(s)
    else groups.push({ date: s.date, items: [s] })
  }
  return groups
}

function StudyRow({ study, subject }: { study: Study; subject?: Subject }) {
  const { state, openStudy, deleteStudy } = useStore()
  const topic = study.topicId ? state.topics.find((t) => t.id === study.topicId) : undefined
  const pages = studyPages(study)
  const questions = study.hits + study.misses

  const remove = () => {
    if (confirmAction('Excluir este estudo? As revisões agendadas a partir dele também serão removidas.')) deleteStudy(study.id)
  }

  return (
    <li className="flex gap-3 py-3">
      <span className="w-1 shrink-0 rounded-full" style={{ background: subject?.color ?? '#ccc' }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide">{subject?.name ?? 'Disciplina removida'}</p>
            <p className="text-sm text-muted">{topic?.name ?? 'Sem tópico'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium tabular" title="Duração">
              <Clock size={14} className="text-muted" /> {fmtClock(study.duration)}
            </span>
            {questions > 0 && <QuestionStats hits={study.hits} misses={study.misses} />}
            {pages > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted" title="Páginas lidas">
                <BookOpen size={14} /> {plural(pages, 'pág.', 'págs.')}
              </span>
            )}
            <div className="flex">
              <IconButton title="Editar estudo" onClick={() => openStudy(editDraft(study))}>
                <Pencil size={15} />
              </IconButton>
              <IconButton title="Excluir estudo" className="hover:text-bad" onClick={remove}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
            {categoryName(state.categories, study.categoryId)}
          </span>
          {study.material && <span className="text-muted">{study.material}</span>}
          {study.time && <span className="tabular text-muted">às {study.time}</span>}
        </div>
        {study.comment && <p className="mt-1.5 text-sm italic text-muted">{study.comment}</p>}
      </div>
    </li>
  )
}

export default function HistoryPage() {
  const { plan, studies, state, openStudy } = useStore()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => sortRecent(applyFilters(studies, filters)), [studies, filters])
  const t = totals(filtered)
  const groups = groupByDate(filtered.slice(0, page * PAGE_SIZE))
  const subjectMap = new Map(state.subjects.map((s) => [s.id, s]))

  const changeFilters = (f: Filters) => {
    setFilters(f)
    setPage(1)
  }

  if (!plan)
    return (
      <>
        <PageHeader title="Histórico" />
        <Card>
          <Empty
            icon={<FolderOpen size={40} />}
            title="Nenhum plano ativo"
            action={
              <Link to="/planos" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                Ir para planos
              </Link>
            }
          >
            Crie ou selecione um plano para ver o histórico de estudos.
          </Empty>
        </Card>
      </>
    )

  return (
    <>
      <PageHeader title="Histórico" />
      <FilterBar value={filters} onChange={changeFilters} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tempo de estudo" value={fmtDuration(t.duration)} sub={plural(filtered.length, 'registro')} />
        <Stat
          label="Desempenho"
          value={`${t.performance}%`}
          sub={
            <>
              <span className="text-ok">{t.hits} acertos</span> · <span className="text-bad">{t.misses} erros</span>
            </>
          }
        />
        <Stat label="Páginas lidas" value={t.pages} sub={`${t.pagesPerHour.toString().replace('.', ',')} páginas por hora`} />
        <Stat label="Dias estudados" value={t.days} sub={t.days ? `${fmtDuration(t.duration / t.days)} por dia (média)` : undefined} />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<HistoryIcon size={40} />}
            title={studies.length ? 'Nenhum estudo encontrado' : 'Nenhum estudo registrado'}
            action={<Button onClick={() => openStudy()}>Adicionar estudo</Button>}
          >
            {studies.length ? 'Tente ajustar os filtros para ver outros registros.' : 'Registre seu primeiro estudo para começar seu histórico.'}
          </Empty>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.date}>
              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <DateBadge date={g.date} />
                  <span className="text-[11px] font-semibold tabular text-muted">{fmtDuration(g.items.reduce((a, s) => a + s.duration, 0))}</span>
                </div>
                <ul className="min-w-0 flex-1 divide-y divide-line">
                  {g.items.map((s) => (
                    <StudyRow key={s.id} study={s} subject={subjectMap.get(s.subjectId)} />
                  ))}
                </ul>
              </div>
            </Card>
          ))}
          {filtered.length > page * PAGE_SIZE && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                Carregar mais ({filtered.length - page * PAGE_SIZE} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
