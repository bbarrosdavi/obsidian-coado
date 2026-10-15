import { Check } from 'lucide-react'
import { clsx, SUBJECT_COLORS } from '../../lib/utils'

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
      {SUBJECT_COLORS.map((c) => {
        const selected = c.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            title={c}
            onClick={() => onChange(c)}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-full border border-black/10 transition hover:scale-110',
              selected && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-surface',
            )}
            style={{ background: c }}
          >
            {selected && <Check size={14} className="text-black/60" />}
          </button>
        )
      })}
    </div>
  )
}
