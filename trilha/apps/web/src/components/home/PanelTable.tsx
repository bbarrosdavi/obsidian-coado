import type { Study, Subject } from '../../lib/types'
import { fmtDuration, totals, type Totals } from '../../lib/utils'
import { Card, ColorDot } from '../ui'
import { PerfBadge } from '../charts/PerfBadge'
import { groupBy } from '../charts/filters'

function Cells({ t }: { t: Totals }) {
  return (
    <>
      <td className="px-2 py-2.5 text-right tabular">{fmtDuration(t.duration)}</td>
      <td className="px-2 py-2.5 text-right tabular text-ok">{t.hits}</td>
      <td className="px-2 py-2.5 text-right tabular text-bad">{t.misses}</td>
      <td className="px-2 py-2.5 text-right tabular">{t.questions}</td>
      <td className="py-2.5 pl-2 text-right">
        <PerfBadge hits={t.hits} misses={t.misses} />
      </td>
    </>
  )
}

export function PanelTable({ subjects, studies, className }: { subjects: Subject[]; studies: Study[]; className?: string }) {
  const bySubject = groupBy(studies, (s) => s.subjectId)
  const rows = subjects.map((s) => ({ subject: s, t: totals(bySubject.get(s.id) ?? []) }))
  const all = totals(studies)

  return (
    <Card title="Painel" className={className}>
      {subjects.length === 0 ? (
        <p className="text-sm text-muted">Cadastre disciplinas para acompanhar seu desempenho por matéria.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-2 pr-2 text-left font-semibold">Disciplina</th>
                <th className="px-2 pb-2 text-right font-semibold">Tempo</th>
                <th className="px-2 pb-2 text-right font-semibold">Acertos</th>
                <th className="px-2 pb-2 text-right font-semibold">Erros</th>
                <th className="px-2 pb-2 text-right font-semibold">Total</th>
                <th className="pb-2 pl-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ subject, t }) => (
                <tr key={subject.id} className="border-t border-line">
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-2">
                      <ColorDot color={subject.color} />
                      <span className="line-clamp-1">{subject.name}</span>
                    </span>
                  </td>
                  <Cells t={t} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <td className="py-2.5 pr-2">Total</td>
                <Cells t={all} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  )
}
