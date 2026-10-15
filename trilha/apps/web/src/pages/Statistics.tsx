import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, FolderOpen } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../components/Layout'
import { Card, ColorDot, Empty, ProgressBar } from '../components/ui'
import { FilterBar } from '../components/charts/FilterBar'
import { Donut } from '../components/charts/Donut'
import { PerfBadge } from '../components/charts/PerfBadge'
import { applyFilters, categoryName, filterRange, groupBy, initialFilters, plural, type Filters } from '../components/charts/filters'
import { BAD, BRAND, OK, axisProps, gridProps, toHours, tooltipProps } from '../components/charts/theme'
import { useStore } from '../lib/store'
import { useTermos } from '../lib/modo'
import type { DateStr, Study } from '../lib/types'
import {
  addDays,
  diffDays,
  fmtDayMonth,
  fmtDuration,
  monthShort,
  parseDate,
  pct,
  startOfMonth,
  startOfWeek,
  toDateStr,
  today,
  totals,
} from '../lib/utils'

type Bucket = 'day' | 'week' | 'month'

const BUCKET_LABEL: Record<Bucket, string> = { day: 'por dia', week: 'por semana', month: 'por mês' }

const bucketFor = (days: number): Bucket => (days <= 60 ? 'day' : days <= 730 ? 'week' : 'month')

const bucketKey = (d: DateStr, b: Bucket) => (b === 'day' ? d : b === 'week' ? startOfWeek(d) : startOfMonth(d))

const nextBucket = (d: DateStr, b: Bucket) => {
  if (b === 'day') return addDays(d, 1)
  if (b === 'week') return addDays(d, 7)
  const date = parseDate(d)
  date.setMonth(date.getMonth() + 1, 1)
  return toDateStr(date)
}

const bucketLabel = (d: DateStr, b: Bucket) => (b === 'month' ? `${monthShort(d)}/${d.slice(2, 4)}` : fmtDayMonth(d))

const short = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const label = 'text-xs font-semibold uppercase tracking-wider text-muted'

function MiniStat({ title, value, children }: { title: string; value: ReactNode; children?: ReactNode }) {
  return (
    <Card>
      <p className={label}>{title}</p>
      <div className="mt-3 text-3xl font-semibold tabular">{value}</div>
      {children && <div className="mt-2 space-y-0.5 text-sm text-muted">{children}</div>}
    </Card>
  )
}

export default function StatisticsPage() {
  const { plan, studies, subjects, state, topicsOf } = useStore()
  const termos = useTermos()
  const [filters, setFilters] = useState<Filters>(initialFilters)

  const data = useMemo(() => {
    const bySubjectFilter = filters.subjectId ? studies.filter((s) => s.subjectId === filters.subjectId) : studies
    const filtered = applyFilters(studies, filters)
    const t = totals(filtered)
    const ref = today()
    const first = bySubjectFilter.reduce<DateStr | null>((min, s) => (!min || s.date < min ? s.date : min), null) ?? ref
    const { from, to } = filterRange(filters)
    const start = from && from > first ? from : first
    const end = to ?? ref
    const rangeDays = Math.max(0, diffDays(end, start) + 1)
    const studiedInRange = new Set(filtered.filter((s) => s.date >= start && s.date <= end).map((s) => s.date)).size

    const bucket = bucketFor(rangeDays)
    const byBucket = groupBy(filtered, (s) => bucketKey(s.date, bucket))
    const timeline: { label: string; hits: number; misses: number; questions: number; perf: number | null; hours: number }[] = []
    for (let k = bucketKey(start, bucket); k <= end; k = nextBucket(k, bucket)) {
      const bt = totals(byBucket.get(k) ?? [])
      timeline.push({
        label: bucketLabel(k, bucket),
        hits: bt.hits,
        misses: bt.misses,
        questions: bt.questions,
        perf: bt.questions ? bt.performance : null,
        hours: toHours(bt.duration),
      })
    }

    const bySubject = groupBy(filtered, (s) => s.subjectId)
    const subjectRows = subjects
      .map((s) => ({ subject: s, name: short(s.name), ...totals(bySubject.get(s.id) ?? []) }))
      .filter((r) => r.duration > 0 || r.questions > 0)
    const subjectHours = [...subjectRows].filter((r) => r.duration > 0).sort((a, b) => b.duration - a.duration).map((r) => ({ ...r, hours: toHours(r.duration) }))
    const subjectPerf = subjectRows.filter((r) => r.questions > 0).map((r) => ({ ...r, perf: r.performance }))

    const categories = [...groupBy(filtered, (s) => s.categoryId)]
      .map(([id, list]) => ({ id, name: categoryName(state.categories, id), duration: list.reduce((a, s) => a + s.duration, 0) }))
      .filter((c) => c.duration > 0)
      .sort((a, b) => b.duration - a.duration)

    const topicMap = new Map(state.topics.map((tp) => [tp.id, tp]))
    const subjectMap = new Map(state.subjects.map((s) => [s.id, s]))
    const topics = [...groupBy(filtered.filter((s) => s.topicId && s.hits + s.misses > 0), (s: Study) => s.topicId!)]
      .map(([id, list]) => {
        const tt = totals(list)
        return { id, topic: topicMap.get(id), subject: subjectMap.get(list[0].subjectId), hits: tt.hits, misses: tt.misses, questions: tt.questions }
      })
      .sort((a, b) => b.questions - a.questions)

    const editalSubjects = filters.subjectId ? subjects.filter((s) => s.id === filters.subjectId) : subjects
    const allTopics = editalSubjects.flatMap((s) => topicsOf(s.id))
    const finishedTopics = allTopics.filter((x) => x.finished).length

    return {
      filtered,
      t,
      rangeDays,
      studiedInRange,
      bucket,
      timeline,
      subjectHours,
      subjectPerf,
      categories,
      topics,
      edital: { finished: finishedTopics, total: allTopics.length },
    }
  }, [studies, filters, subjects, state.categories, state.topics, state.subjects, topicsOf])

  if (!plan)
    return (
      <>
        <PageHeader title="Estatísticas" />
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
            Crie ou selecione um plano para ver suas estatísticas.
          </Empty>
        </Card>
      </>
    )

  const { t, rangeDays, studiedInRange, bucket, timeline, subjectHours, subjectPerf, categories, topics, edital } = data
  const failedDays = Math.max(0, rangeDays - studiedInRange)
  const editalPct = pct(edital.finished, edital.total)
  const maxCategory = categories[0]?.duration ?? 0

  return (
    <>
      <PageHeader title="Estatísticas" />
      <FilterBar value={filters} onChange={setFilters} showCategory={false} />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className={label}>Desempenho</p>
          <div className="mt-3 flex items-center gap-5">
            <Donut hits={t.hits} misses={t.misses} size={112} />
            <div className="space-y-0.5 text-sm">
              <p>
                <b className="tabular text-ok">{t.hits}</b> <span className="text-muted">acertos</span>
              </p>
              <p>
                <b className="tabular text-bad">{t.misses}</b> <span className="text-muted">erros</span>
              </p>
              <p className="pt-1 text-muted">{plural(t.questions, 'questão resolvida', 'questões resolvidas')}</p>
            </div>
          </div>
        </Card>
        <MiniStat title="Tempo de estudo" value={fmtDuration(t.duration)}>
          <p>{t.days ? fmtDuration(t.duration / t.days) : '0min'} por dia estudado (média)</p>
          <p>
            {plural(t.days, 'dia estudado', 'dias estudados')} · {plural(rangeDays, 'dia total', 'dias totais')}
          </p>
        </MiniStat>
        <MiniStat title="Páginas lidas" value={t.pages}>
          <p>{t.pagesPerHour.toString().replace('.', ',')} páginas por hora</p>
        </MiniStat>
        <MiniStat title="Videoaulas" value={fmtDuration(t.videoSeconds)}>
          <p>tempo total de vídeo assistido</p>
        </MiniStat>
        <MiniStat title="Constância" value={`${pct(studiedInRange, rangeDays)}%`}>
          <p>
            <span className="text-ok">{plural(studiedInRange, 'dia estudado', 'dias estudados')}</span> ·{' '}
            <span className="text-bad">{plural(failedDays, 'falha', 'falhas')}</span>
          </p>
        </MiniStat>
        <MiniStat title={termos.progresso} value={`${editalPct}%`}>
          <ProgressBar value={editalPct} className="mb-1.5" />
          <p>
            {edital.finished} de {plural(edital.total, 'tópico concluído', 'tópicos concluídos')}
          </p>
        </MiniStat>
      </div>

      {data.filtered.length === 0 ? (
        <Card>
          <Empty icon={<BarChart3 size={40} />} title="Sem dados no período">
            Registre estudos ou ajuste os filtros para ver os gráficos.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={`Evolução no tempo (${BUCKET_LABEL[bucket]})`} className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis yAxisId="q" {...axisProps} allowDecimals={false} />
                  <YAxis yAxisId="pct" orientation="right" {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...tooltipProps} formatter={(v, name) => (name === 'Desempenho' ? [`${v}%`, name] : [v, name])} />
                  <Bar yAxisId="q" dataKey="hits" name="Acertos" stackId="q" fill={OK} maxBarSize={28} />
                  <Bar yAxisId="q" dataKey="misses" name="Erros" stackId="q" fill={BAD} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line yAxisId="pct" dataKey="perf" name="Desempenho" stroke={BRAND} strokeWidth={2} dot={{ r: 2.5 }} connectNulls type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title={`Horas de estudo (${BUCKET_LABEL[bucket]})`} className="lg:col-span-2">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeline} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} minTickGap={12} />
                  <YAxis {...axisProps} tickFormatter={(v) => `${v}h`} />
                  <Tooltip {...tooltipProps} formatter={(v) => [fmtDuration(Number(v) * 3600), 'Tempo']} />
                  <Bar dataKey="hours" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Disciplinas × horas">
            {subjectHours.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhum tempo registrado.</p>
            ) : (
              <div style={{ height: Math.max(160, subjectHours.length * 34 + 30) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectHours} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid {...gridProps} vertical horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `${v}h`} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={130} interval={0} />
                    <Tooltip {...tooltipProps} formatter={(v) => [fmtDuration(Number(v) * 3600), 'Tempo']} labelFormatter={(_, p) => p?.[0]?.payload?.subject?.name ?? ''} />
                    <Bar dataKey="hours" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {subjectHours.map((r) => (
                        <Cell key={r.subject.id} fill={r.subject.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Categorias × horas">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhum tempo registrado.</p>
            ) : (
              <ol className="space-y-3">
                {categories.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 rounded-md bg-brand-50 py-1 text-center text-[10px] font-bold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                      TOP {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{c.name}</span>
                        <span className="shrink-0 text-xs tabular text-muted">
                          {fmtDuration(c.duration)} · {pct(c.duration, t.duration)}%
                        </span>
                      </div>
                      <ProgressBar value={(c.duration / maxCategory) * 100} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Disciplinas × desempenho" className="lg:col-span-2">
            {subjectPerf.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhuma questão registrada no período.</p>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={subjectPerf} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" {...axisProps} interval={0} angle={-30} textAnchor="end" height={80} />
                    <YAxis yAxisId="q" {...axisProps} allowDecimals={false} />
                    <YAxis yAxisId="pct" orientation="right" {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      {...tooltipProps}
                      labelFormatter={(_, p) => p?.[0]?.payload?.subject?.name ?? ''}
                      formatter={(v, name) => (name === 'Desempenho' ? [`${v}%`, name] : [v, name])}
                    />
                    <Bar yAxisId="q" dataKey="questions" name="Questões" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {subjectPerf.map((r) => (
                        <Cell key={r.subject.id} fill={r.subject.color} />
                      ))}
                    </Bar>
                    <Line yAxisId="pct" dataKey="perf" name="Desempenho" stroke={BRAND} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Tópicos × desempenho" className="lg:col-span-2">
            {topics.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhuma questão registrada em tópicos no período.</p>
            ) : (
              <div className="-mx-5 max-h-[28rem] overflow-auto px-5">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-[11px] uppercase tracking-wide text-muted">
                      <th className="pb-2 pr-2 text-left font-semibold">Disciplina</th>
                      <th className="px-2 pb-2 text-left font-semibold">Tópico</th>
                      <th className="px-2 pb-2 text-right font-semibold">Questões</th>
                      <th className="px-2 pb-2 text-right font-semibold">Acertos</th>
                      <th className="pb-2 pl-2 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((r) => (
                      <tr key={r.id} className="border-t border-line">
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-2">
                            <ColorDot color={r.subject?.color ?? '#ccc'} />
                            <span className="line-clamp-1">{r.subject?.name ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="line-clamp-2">{r.topic?.name ?? 'Tópico removido'}</span>
                        </td>
                        <td className="px-2 py-2 text-right tabular">{r.questions}</td>
                        <td className="px-2 py-2 text-right tabular text-ok">{r.hits}</td>
                        <td className="py-2 pl-2 text-right">
                          <PerfBadge hits={r.hits} misses={r.misses} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
