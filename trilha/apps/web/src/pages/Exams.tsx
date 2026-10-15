import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ClipboardCheck, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/Layout'
import { Button, Card, Empty, IconButton, Tabs, confirmAction } from '../components/ui'
import { ExamModal } from '../components/exams/ExamModal'
import { fmtNum, STYLE_LABEL, summarizeExam } from '../components/exams/examUtils'
import { NoPlan } from '../components/subjects/NoPlan'
import { useStore } from '../lib/store'
import type { Exam } from '../lib/types'
import { fmtClock, fmtDate, fmtDayMonth } from '../lib/utils'

type ChartMode = 'performance' | 'score'

export default function ExamsPage() {
  const { plan, exams, deleteExam } = useStore()
  const [editing, setEditing] = useState<Exam | 'new' | null>(null)
  const [mode, setMode] = useState<ChartMode>('performance')

  // store já entrega ordenado do mais recente para o mais antigo
  const rows = useMemo(() => exams.map((e) => ({ exam: e, sum: summarizeExam(e) })), [exams])
  const chartData = useMemo(
    () =>
      [...rows].reverse().map(({ exam, sum }) => ({
        label: fmtDayMonth(exam.date),
        name: exam.name,
        performance: sum.performance,
        score: sum.score,
      })),
    [rows],
  )

  const header = (
    <PageHeader title="Simulados">
      {plan && (
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Plus size={16} /> Novo simulado
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

  const last = rows[0]

  const remove = (e: Exam) => {
    if (confirmAction(`Excluir o simulado "${e.name}"?`)) deleteExam(e.id)
  }

  return (
    <>
      {header}

      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={<ClipboardCheck size={36} />}
            title="Você ainda não registrou nenhum simulado"
            action={
              <Button onClick={() => setEditing('new')}>
                <Plus size={16} /> Novo simulado
              </Button>
            }
          >
            Registre seus simulados para acompanhar a evolução do desempenho e da pontuação.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
              <Card title="Simulados realizados">
                <div className="text-4xl font-semibold tabular">{rows.length}</div>
              </Card>
              <Card title="Último simulado">
                <p className="truncate text-sm font-medium" title={last.exam.name}>
                  {last.exam.name}
                </p>
                <p className="text-xs text-muted">{fmtDate(last.exam.date)}</p>
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center lg:grid-cols-2 2xl:grid-cols-4">
                  <MiniStat label="Acertos" value={last.sum.hits} className="text-ok" />
                  <MiniStat label="Brancos" value={last.sum.blanks} />
                  <MiniStat label="Erros" value={last.sum.misses} className="text-bad" />
                  <MiniStat label="%" value={`${last.sum.performance}%`} />
                </div>
              </Card>
            </div>
            <Card
              title="Seu desempenho"
              className="lg:col-span-2"
              actions={
                <Tabs<ChartMode>
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'performance', label: 'Desempenho %' },
                    { value: 'score', label: 'Pontuação' },
                  ]}
                />
              }
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="var(--app-line)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--app-line)" tick={{ fill: 'var(--app-muted)', fontSize: 12 }} tickLine={false} />
                    <YAxis
                      stroke="var(--app-line)"
                      tick={{ fill: 'var(--app-muted)', fontSize: 12 }}
                      tickLine={false}
                      domain={mode === 'performance' ? [0, 100] : ['auto', 'auto']}
                      tickFormatter={(v: number) => (mode === 'performance' ? `${v}%` : fmtNum(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-line)',
                        borderRadius: 8,
                        color: 'var(--app-ink)',
                        fontSize: 12,
                      }}
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload as { name?: string; label?: string } | undefined
                        return p ? `${p.label} · ${p.name}` : ''
                      }}
                      formatter={(v: number) => [mode === 'performance' ? `${v}%` : fmtNum(v), mode === 'performance' ? 'Desempenho' : 'Pontuação']}
                    />
                    <Line
                      type="monotone"
                      dataKey={mode}
                      stroke="#96663b"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#96663b' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card title="Histórico de simulados">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[960px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-2 text-left">Data</th>
                    <th className="px-2 py-2 text-left">Nome</th>
                    <th className="px-2 py-2 text-left">Banca</th>
                    <th className="px-2 py-2 text-left">Estilo</th>
                    <th className="px-2 py-2 text-center">Tempo</th>
                    <th className="px-2 py-2 text-center">Questões</th>
                    <th className="px-2 py-2 text-center text-ok">Acertos</th>
                    <th className="px-2 py-2 text-center text-bad">Erros</th>
                    <th className="px-2 py-2 text-center">Brancos</th>
                    <th className="px-2 py-2 text-center">%</th>
                    <th className="px-2 py-2 text-center">Pontuação</th>
                    <th className="w-24 px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ exam: e, sum }) => (
                    <tr key={e.id} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                      <td className="px-5 py-2.5 tabular">{fmtDate(e.date)}</td>
                      <td className="px-2 py-2.5 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {e.name}
                          {e.comment && (
                            <span title={e.comment} className="text-muted">
                              <MessageSquare size={13} />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-muted">{e.board || '-'}</td>
                      <td className="px-2 py-2.5 text-muted">{STYLE_LABEL[e.style]}</td>
                      <td className="px-2 py-2.5 text-center tabular">{fmtClock(e.timeSpent)}</td>
                      <td className="px-2 py-2.5 text-center tabular">{sum.total}</td>
                      <td className="px-2 py-2.5 text-center text-ok tabular">{sum.hits}</td>
                      <td className="px-2 py-2.5 text-center text-bad tabular">{sum.misses}</td>
                      <td className="px-2 py-2.5 text-center tabular">{sum.blanks}</td>
                      <td className="px-2 py-2.5 text-center font-semibold tabular">{sum.performance}%</td>
                      <td className="px-2 py-2.5 text-center tabular">
                        {fmtNum(sum.score)}
                        <span className="text-xs text-muted">/{fmtNum(sum.maxScore)}</span>
                      </td>
                      <td className="px-5 py-1.5 text-right">
                        <IconButton title="Editar simulado" onClick={() => setEditing(e)}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton title="Excluir simulado" onClick={() => remove(e)} className="hover:text-bad">
                          <Trash2 size={15} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {editing && <ExamModal exam={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function MiniStat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-1 py-2">
      <div className={`text-base font-semibold tabular ${className ?? ''}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  )
}
