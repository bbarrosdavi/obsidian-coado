import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useStore } from '../../lib/store'
import { firstName, useMe } from '../../lib/auth'
import { constancy, cycleProgress, fmtMinutes, today } from '../../lib/utils'
import { LampArt } from '../art'

const greeting = () => {
  const h = new Date().getHours()
  if (h < 5) return 'Madrugada produtiva'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Faixa de boas-vindas no topo do Início: saudação, sequência e a próxima sessão do ciclo */
export function CozyBanner() {
  const { studies, reviews, planning, subjects, openTimer } = useStore()
  const me = useMe()
  const c = constancy(studies)
  const due = reviews.filter((r) => r.status === 'pending' && r.dueDate <= today()).length
  const next = planning ? cycleProgress(planning, studies).find((i) => !i.done) : undefined
  const nextSubject = next && subjects.find((s) => s.id === next.subjectId)

  const line =
    c.current > 0
      ? `Você está há ${c.current} ${c.current === 1 ? 'dia' : 'dias'} seguidos estudando. Mantém o ritmo.`
      : c.daysSinceLast === null
        ? 'Registra o primeiro estudo: 30 minutos já contam.'
        : `Faz ${c.daysSinceLast} ${c.daysSinceLast === 1 ? 'dia' : 'dias'} desde o último estudo. 30 minutos hoje já contam.`

  return (
    <section className="mb-6 flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-brand-100 via-surface to-surface p-5 dark:from-brand-900/60">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl font-bold">{greeting()}, {firstName(me.name)}.</h2>
        <p className="mt-1 text-sm text-muted">{line}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {nextSubject && (
            <button
              onClick={() => openTimer({ subjectId: nextSubject.id })}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
            >
              <Play size={12} /> Próxima do ciclo: {nextSubject.name} · {fmtMinutes(next!.duration)}
            </button>
          )}
          {due > 0 && (
            <Link to="/revisoes" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2">
              {due} {due === 1 ? 'revisão pendente' : 'revisões pendentes'}
            </Link>
          )}
        </div>
      </div>
      <LampArt className="hidden h-28 w-auto shrink-0 sm:block" />
    </section>
  )
}
