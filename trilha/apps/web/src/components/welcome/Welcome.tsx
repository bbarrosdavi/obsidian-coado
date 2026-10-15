import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react'
import type { AppState } from '@coado/shared'
import { firstName, useAuth, useMe } from '../../lib/auth'
import { markLegacyMigrated, readLegacyState } from '../../lib/legacy'
import { useStore } from '../../lib/store'
import { clsx } from '../../lib/utils'
import { CatWindowArt } from '../art'
import { CalendarArt, ChartArt, CycleArt, FilesArt, ProgressRing, SubjectsArt, TimerArt } from '../study-art'
import { BRAND } from '../../lib/brand'

/*
 * Apresentação da plataforma no primeiro acesso, em passos; o anel ao lado se completa conforme a pessoa
 * avança. Pode ser revista pelo Perfil.
 */

interface Step {
  kicker: string
  title: (name: string) => string
  body: string
  bullets?: string[]
  art: ReactNode
}

const STEPS: Step[] = [
  {
    kicker: 'boas-vindas',
    title: (name) => `Puxa uma cadeira, ${name}.`,
    body: `O ${BRAND} é um lugar calmo para planejar seus estudos, estudar no seu ritmo e ver a evolução acontecer. Em alguns passos a gente te mostra como funciona.`,
    art: <CatWindowArt className="w-full" />,
  },
  {
    kicker: 'passo 1 · comece pelo plano',
    title: () => 'Planos, disciplinas e edital',
    body: 'Tudo começa pelo plano: o concurso que você quer, a data da prova e suas metas da semana.',
    bullets: [
      'Um plano para cada concurso, com contagem regressiva até a prova',
      'Disciplinas com cor própria e os tópicos do edital verticalizado',
      'Marque o que já viu e acompanhe quanto do edital já foi',
    ],
    art: <SubjectsArt className="w-full" />,
  },
  {
    kicker: 'passo 2 · estude com o tempo contando',
    title: () => 'Cronômetro e registro de estudos',
    body: `Dê o play e estude. Ao terminar, o ${BRAND} já sugere o registro com o tempo cronometrado.`,
    bullets: [
      'Cronômetro, pomodoro e temporizador: o botão ⏱ fica sempre no canto da tela',
      'Registre questões, páginas e vídeos de cada sessão',
      'Um bloco de notas rápido para não perder nenhuma ideia',
    ],
    art: <TimerArt className="w-full" />,
  },
  {
    kicker: 'passo 3 · siga o ritmo certo',
    title: () => 'Planejamento em ciclo ou semana',
    body: `Diga quanto tempo tem e quais matérias pesam mais; o ${BRAND} monta a sequência para você.`,
    bullets: [
      'Ciclo de estudos gerado pelo peso e pelo seu domínio de cada disciplina',
      'Ou uma grade semanal com os dias que você tem livres',
      'A próxima sessão do ciclo aparece logo no Início',
    ],
    art: <CycleArt className="w-full" />,
  },
  {
    kicker: 'passo 4 · revise na hora certa',
    title: () => 'Revisões espaçadas',
    body: 'Conteúdo sem revisão se perde. Cada estudo registrado agenda as revisões na hora certa.',
    bullets: ['Revisões automáticas em 1, 7, 30 dias (ou nos intervalos que preferir)', 'As revisões do dia aparecem no Início', 'Marque como feita ou ignore com um toque'],
    art: <CalendarArt className="w-full" />,
  },
  {
    kicker: 'passo 5 · veja e ajuste',
    title: () => 'Estatísticas, histórico e simulados',
    body: 'Veja onde você está acertando e o que merece mais atenção.',
    bullets: ['Tempo, desempenho e constância por disciplina', 'Histórico completo de cada sessão de estudo', 'Simulados com nota por matéria e evolução'],
    art: <ChartArt className="w-full" />,
  },
  {
    kicker: 'passo 6 · tudo na sua conta',
    title: () => 'Sua mesa, guardada com você',
    body: 'Planos, histórico, preferências e seus arquivos (PDFs, resumos, editais) ficam salvos na sua conta e sincronizam entre os seus aparelhos.',
    art: <FilesArt className="w-full" />,
  },
]

type Start = 'legacy' | 'sample' | 'empty'

interface WelcomeCtx {
  openWelcome: () => void
}

const Ctx = createContext<WelcomeCtx | null>(null)

export function useWelcome() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWelcome fora do WelcomeProvider')
  return ctx
}

/** Abre a apresentação sozinha no primeiro acesso e permite reabrir depois */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const me = useMe()
  const [open, setOpen] = useState(!me.onboardedAt)
  const value = useMemo(() => ({ openWelcome: () => setOpen(true) }), [])
  return (
    <Ctx.Provider value={value}>
      {children}
      {open && <WelcomeDialog onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  )
}

function WelcomeDialog({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const { updateProfile } = useAuth()
  const { state, importState, resetAll } = useStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const primaryRef = useRef<HTMLButtonElement>(null)

  const legacy = useMemo<AppState | null>(() => readLegacyState(), [])
  const isEmpty = state.plans.length === 0
  const [start, setStart] = useState<Start>(legacy ? 'legacy' : 'empty')

  const last = step === STEPS.length - 1
  const s = STEPS[step]

  const finish = useCallback(
    async (choice: Start | null) => {
      setBusy(true)
      setError('')
      try {
        if (choice === 'legacy' && legacy) {
          await importState(legacy)
          markLegacyMigrated()
        } else if (choice === 'sample') {
          await resetAll(true)
        }
        if (!me.onboardedAt) await updateProfile({ onboarded: true })
        onClose()
        if (choice === 'empty') navigate('/planos')
      } catch (e) {
        setError((e as Error).message || 'Não deu para servir agora. Tenta de novo?')
        setBusy(false)
      }
    },
    [legacy, importState, resetAll, me.onboardedAt, updateProfile, onClose, navigate],
  )

  const skip = useCallback(() => void finish(null), [finish])
  const next = useCallback(() => (last ? void finish(isEmpty ? start : null) : setStep((n) => n + 1)), [last, finish, isEmpty, start])
  const back = useCallback(() => setStep((n) => Math.max(0, n - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return
      if (e.key === 'Escape') skip()
      else if (e.key === 'ArrowRight' && !last) next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, skip, next, back, last])

  useEffect(() => primaryRef.current?.focus(), [step])

  const options: { value: Start; title: string; desc: string }[] = [
    ...(legacy
      ? [
          {
            value: 'legacy' as const,
            title: 'Trazer meus dados deste navegador',
            desc: `Encontrei ${legacy.plans.length} plano(s) e ${legacy.studies.length} estudo(s) salvos aqui antes da conta.`,
          },
        ]
      : []),
    { value: 'sample', title: 'Explorar com um plano de exemplo', desc: 'Petrobrás: disciplinas, edital, histórico e ciclo prontos pra fuçar.' },
    { value: 'empty', title: 'Começar do zero', desc: 'Mesa limpa. Você cria seu primeiro plano agora.' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#1b1410]/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative my-6 grid w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl animate-rise md:grid-cols-[250px_1fr]"
      >
        <button
          onClick={skip}
          disabled={busy}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Pular apresentação"
          title="Pular apresentação"
        >
          <X size={18} />
        </button>

        {/* painel ilustrado */}
        <aside className="relative flex flex-col items-center justify-between gap-4 bg-gradient-to-b from-brand-100 to-kraft px-6 pb-6 pt-8 dark:from-brand-900/70 dark:to-kraft">
          <div key={step} className="flex w-full max-w-[200px] flex-1 items-center animate-rise">
            {s.art}
          </div>
          <div className="flex items-center gap-3">
            <ProgressRing level={(step + 1) / STEPS.length} className="h-16 w-16" />
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">seu progresso</p>
              <p className="font-display text-lg font-bold tabular">
                {Math.round(((step + 1) / STEPS.length) * 100)}%
              </p>
            </div>
          </div>
        </aside>

        {/* conteúdo */}
        <div className="flex min-h-[440px] flex-col px-6 pb-6 pt-8 sm:px-8">
          <div key={step} className="flex-1 animate-rise">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">{s.kicker}</p>
            <h2 id="welcome-title" className="mt-2 font-display text-3xl font-bold leading-tight">
              {s.title(firstName(me.name))}
            </h2>
            <p className="mt-3 text-muted">{s.body}</p>

            {s.bullets && (
              <ul className="mt-5 space-y-2.5">
                {s.bullets.map((b, i) => (
                  <li key={b} className="flex gap-3 text-sm animate-rise" style={{ animationDelay: `${120 + i * 80}ms` }}>
                    <Marker className="mt-0.5 h-4 w-4 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            )}

            {last && isEmpty && (
              <fieldset className="mt-5 space-y-2">
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Como você quer começar?</legend>
                {options.map((o) => (
                  <label
                    key={o.value}
                    className={clsx(
                      'flex cursor-pointer gap-3 rounded-2xl border-2 p-3 transition',
                      start === o.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-600/10' : 'border-line hover:border-brand-300',
                    )}
                  >
                    <input type="radio" name="start" className="mt-1" checked={start === o.value} onChange={() => setStart(o.value)} />
                    <span>
                      <span className="block text-sm font-semibold">{o.title}</span>
                      <span className="block text-xs text-muted">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            {last && !isEmpty && (
              <p className="mt-5 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
                Seus dados já estão na conta. Arquivos e perfil ficam no menu lateral, quando precisar.
              </p>
            )}
            {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          </div>

          <footer className="mt-6 flex items-center gap-3">
            <div className="mr-auto flex gap-1.5" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => !busy && setStep(i)}
                  aria-label={`Ir para o passo ${i + 1}`}
                  className={clsx('h-2 rounded-full transition-all', i === step ? 'w-6 bg-brand-600' : i < step ? 'w-2 bg-brand-300' : 'w-2 bg-line')}
                />
              ))}
            </div>
            {step > 0 && (
              <button onClick={back} disabled={busy} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
                <ArrowLeft size={16} /> Voltar
              </button>
            )}
            <button
              ref={primaryRef}
              onClick={next}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-70"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : last ? <Check size={16} /> : null}
              {last ? 'Começar' : step === 0 ? 'Bora conhecer' : 'Próximo'}
              {!last && <ArrowRight size={16} />}
            </button>
          </footer>
        </div>
      </div>
    </div>
  )
}

/** Marcador de lista: um ponto com um traço de "feito" */
function Marker({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="7" className="fill-brand-100 dark:fill-brand-900" />
      <path d="M4.8 8.2l2.1 2.1l4.3-4.6" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-600" />
    </svg>
  )
}
