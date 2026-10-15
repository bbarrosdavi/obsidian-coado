import { useStore } from '../../lib/store'
import { clsx } from '../../lib/utils'
import { PERIODS, type Filters } from './filters'

export function FilterBar({
  value,
  onChange,
  showCategory = true,
}: {
  value: Filters
  onChange: (f: Filters) => void
  showCategory?: boolean
}) {
  const { subjects, state } = useStore()
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => set({ period: p.value })}
            className={clsx(
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              value.period === p.value ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {value.period === 'custom' && (
          <>
            <label className="w-full sm:w-40">
              <span className="label">De</span>
              <input type="date" className="field" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label className="w-full sm:w-40">
              <span className="label">Até</span>
              <input type="date" className="field" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </label>
          </>
        )}
        <label className="w-full sm:w-56">
          <span className="label">Disciplina</span>
          <select className="field" value={value.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
            <option value="">Todas as disciplinas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {showCategory && (
          <label className="w-full sm:w-48">
            <span className="label">Categoria</span>
            <select className="field" value={value.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">Todas as categorias</option>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}
