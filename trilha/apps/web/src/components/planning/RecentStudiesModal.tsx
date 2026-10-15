import { useStore } from '../../lib/store'
import { fmtDate, fmtDuration } from '../../lib/utils'
import { Modal } from '../ui'

/** Últimos 10 estudos de uma disciplina */
export function RecentStudiesModal({ subjectId, onClose }: { subjectId: string; onClose: () => void }) {
  const { state, studies } = useStore()
  const subject = state.subjects.find((s) => s.id === subjectId)
  const recent = studies
    .filter((s) => s.subjectId === subjectId)
    .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))
    .slice(0, 10)

  return (
    <Modal open onClose={onClose} size="md" title={`Últimos estudos · ${subject?.name ?? 'Disciplina'}`}>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum estudo registrado para esta disciplina.</p>
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 tabular text-muted">{fmtDate(s.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{state.topics.find((t) => t.id === s.topicId)?.name ?? 'Sem tópico'}</span>
                <span className="text-xs text-muted">{state.categories.find((c) => c.id === s.categoryId)?.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular">{fmtDuration(s.duration)}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
