import { useState } from 'react'
import { StickyNote, X } from 'lucide-react'
import { useStore } from '../lib/store'

/** Bloco de anotações rápido, flutuante — papel kraft */
export function NoteWidget() {
  const { state, setNote } = useStore()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-14 right-0 w-72 rotate-[-1deg] rounded-xl border border-line bg-kraft p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-brand-800 dark:text-brand-200">Anotações ✎</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink" aria-label="Fechar anotações">
              <X size={16} />
            </button>
          </div>
          <textarea
            autoFocus
            value={state.note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escreva aqui… (salvo automaticamente)"
            className="h-56 w-full resize-none bg-transparent text-sm leading-6 text-ink outline-none placeholder:text-muted/70"
            style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 23px, var(--app-line) 23px 24px)' }}
          />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Anotações"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-brand-600 shadow-lg transition hover:scale-105"
      >
        <StickyNote size={20} />
      </button>
    </div>
  )
}
