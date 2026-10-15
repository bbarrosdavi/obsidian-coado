import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import type { AuthConfig, AuthErrorCode } from '@coado/shared'
import { useAuth } from '../lib/auth'
import { native } from '../lib/native'
import { Logo } from '../components/Layout'
import { DeskSceneArt, GoogleG } from '../components/study-art'
import { TAGLINE } from '../lib/brand'
import { clsx } from '../lib/utils'

const AUTH_ERRORS: Record<AuthErrorCode, string> = {
  denied: 'Login cancelado. Quando quiser, é só tentar de novo.',
  state: 'O login demorou demais ou veio de outra aba. Tenta mais uma vez?',
  exchange: 'O Google não confirmou o login agora. Tenta de novo em instantes.',
  email: 'Sua conta Google precisa ter o e-mail verificado.',
  config: 'O login com Google não está configurado neste servidor.',
}

const MOMENTS = [
  { until: 5, hello: 'Ainda acordado?', line: 'Madrugada rende revisão, mas o sono também conta.' },
  { until: 12, hello: 'Bom dia!', line: 'De manhã cabe o conteúdo mais pesado.' },
  { until: 18, hello: 'Boa tarde.', line: 'Ainda dá tempo de mais um bloco de estudos.' },
  { until: 24, hello: 'Boa noite.', line: 'Uma sessão curta hoje já conta.' },
]

const MENU = [
  ['Ciclo de estudos', 'pelo peso de cada matéria'],
  ['Pomodoro', 'com pausas curtas e longas'],
  ['Revisões espaçadas', '1 · 7 · 30 dias'],
  ['Edital ou programa', 'tópico a tópico'],
  ['Estatísticas', 'tempo, acertos e constância'],
]

/** Lê e limpa ?authError= da URL (vem do callback do Google) */
function useAuthError() {
  const [code] = useState(() => new URLSearchParams(window.location.search).get('authError') as AuthErrorCode | null)
  useEffect(() => {
    if (!code) return
    const url = new URL(window.location.href)
    url.searchParams.delete('authError')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [code])
  return code && code in AUTH_ERRORS ? AUTH_ERRORS[code] : null
}

export default function LoginPage({ config, reason }: { config: AuthConfig | null; reason?: 'expired' | 'offline' }) {
  const { signInWithGoogle, devLogin, reload } = useAuth()
  const authError = useAuthError()
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null)
  const [devError, setDevError] = useState('')
  const moment = MOMENTS.find((m) => new Date().getHours() < m.until) ?? MOMENTS[3]

  const google = () => {
    // na WebView do app o Google recusa o fluxo web: o app faz o login nativo e renova a sessão daqui
    const app = native()
    if (app) return app.signIn()
    setBusy('google')
    signInWithGoogle()
  }

  const dev = async () => {
    setBusy('dev')
    setDevError('')
    try {
      await devLogin()
    } catch (e) {
      setDevError((e as Error).message)
      setBusy(null)
    }
  }

  const notice = authError ?? (reason === 'expired' ? 'Sua sessão expirou. Entre de novo para continuar de onde parou.' : null)
  const unreachable = !config

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* cena */}
      <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-b from-brand-100 via-kraft to-brand-200 px-6 pb-6 pt-10 dark:from-brand-900 dark:via-surface dark:to-bg lg:min-h-screen lg:px-12 lg:pb-10">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-700/20" />
        <DeskSceneArt className="mx-auto w-full max-w-[600px] animate-rise" />
</section>

      {/* entrada */}
      <main className="flex items-center justify-center px-6 py-10 lg:px-12">
        <div className="w-full max-w-md">
          <Logo className="animate-rise" />
          <p className="mt-8 font-display text-lg italic text-muted animate-rise" style={{ animationDelay: '80ms' }}>
            {moment.hello}
          </p>
          <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight animate-rise" style={{ animationDelay: '120ms' }}>
            Seus estudos, organizados.
          </h1>
          <p className="mt-3 text-muted animate-rise" style={{ animationDelay: '160ms' }}>
            {moment.line} Planeje o edital, cronometre as sessões, revise no tempo certo e veja o progresso aparecer, {TAGLINE}
          </p>

          {notice && (
            <p role="alert" className="mt-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
              {notice}
            </p>
          )}

          <div className="mt-8 space-y-3 animate-rise" style={{ animationDelay: '220ms' }}>
            {unreachable ? (
              <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
                <p className="font-semibold">O servidor não respondeu.</p>
                <p className="mt-1 text-muted">Não consegui falar com o servidor. Confere a conexão e tenta de novo.</p>
                <button onClick={reload} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2">
                  <RefreshCcw size={14} /> Tentar de novo
                </button>
              </div>
            ) : (
              <>
                {config.google ? (
                  <button
                    onClick={google}
                    disabled={busy !== null}
                    className={clsx(
                      'group flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition',
                      'hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:opacity-70 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3]',
                    )}
                  >
                    {busy === 'google' ? <Loader2 size={20} className="animate-spin" /> : <GoogleG className="h-5 w-5" />}
                    Continuar com o Google
                  </button>
                ) : (
                  <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
                    Login com Google ainda não configurado. Defina <code className="font-semibold">GOOGLE_CLIENT_ID</code> e{' '}
                    <code className="font-semibold">GOOGLE_CLIENT_SECRET</code> no <code>.env</code> do servidor.
                  </p>
                )}
                {config.devLogin && (
                  <button
                    onClick={dev}
                    disabled={busy !== null}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-line text-sm font-medium text-muted transition hover:border-brand-400 hover:text-ink disabled:opacity-60"
                  >
                    {busy === 'dev' && <Loader2 size={16} className="animate-spin" />}
                    Entrar como visitante <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase">dev</span>
                  </button>
                )}
                {devError && <p className="text-sm text-bad">{devError}</p>}
              </>
            )}
          </div>

          {/* o que tem aqui */}
          <section aria-label="O que tem aqui" className="chalkboard mt-10 rounded-2xl border-[6px] border-brand-700 p-5 shadow-[inset_0_0_30px_rgba(0,0,0,0.35)] animate-rise" style={{ animationDelay: '300ms' }}>
            <p className="text-center font-display text-lg italic tracking-wide">o que tem aqui</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {MENU.map(([item, note]) => (
                <li key={item} className="flex items-baseline gap-2">
                  <span className="font-bold">{item}</span>
                  <span className="flex-1 border-b border-dotted border-white/25" />
                  <span className="font-display italic text-white/75">{note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-center text-xs text-white/60">tudo na sua conta, em todos os seus aparelhos</p>
          </section>

          <p className="mt-6 text-center text-xs text-muted">
            Ao entrar, seus planos, arquivos e histórico ficam guardados na sua conta e só você tem acesso.
          </p>
        </div>
      </main>
    </div>
  )
}
