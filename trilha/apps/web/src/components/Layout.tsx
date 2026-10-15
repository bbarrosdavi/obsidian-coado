import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  FolderOpen,
  History,
  Home,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Paperclip,
  RefreshCcw,
  Settings,
  Sun,
  Timer,
  X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { clsx } from '../lib/utils'
import { StudyModal } from './StudyModal'
import { TimerOverlay } from './TimerOverlay'
import { NoteWidget } from './NoteWidget'
import { CatWindowArt } from './art'
import { BRAND_SLUG, TAGLINE } from '../lib/brand'
import { Avatar, SyncBadge } from './account'
import { useTermos } from '../lib/modo'
import { useAuth, useMe } from '../lib/auth'

/** O menu muda com o tipo do plano ativo: edital vira programa, simulados viram avaliações */
const useNav = () => {
  const t = useTermos()
  return [
    { to: '/', label: 'Início', icon: Home, end: true },
    { to: '/planos', label: 'Planos', icon: FolderOpen },
    { to: '/disciplinas', label: 'Disciplinas', icon: BookOpen },
    { to: '/edital', label: t.edital, icon: ListChecks },
    { to: '/planejamento', label: 'Planejamento', icon: CalendarRange },
    { to: '/revisoes', label: 'Revisões', icon: RefreshCcw },
    { to: '/historico', label: 'Histórico', icon: History },
    { to: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
    { to: t.rotaAvaliacoes, label: t.avaliacoes, icon: ClipboardCheck },
    { to: '/arquivos', label: 'Arquivos', icon: Paperclip },
  ]
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-100 dark:fill-brand-900" />
        {/* trilha: um caminho entre dois marcos */}
        <path d="M9 23c5 0 4-6 7-6s3-6 7-6" fill="none" strokeWidth="2.4" strokeLinecap="round" className="stroke-brand-600" />
        <circle cx="9" cy="23" r="2.8" className="fill-brand-600" />
        <circle cx="23" cy="11" r="2.8" className="fill-brand-400" />
      </svg>
      <span className="font-display text-2xl font-bold tracking-tight">{BRAND_SLUG}</span>
    </div>
  )
}

export function Layout() {
  const { state, setTheme, openTimer, timer } = useStore()
  const [open, setOpen] = useState(false)
  const nav = useNav()
  const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className="min-h-screen lg:pl-64">
      {/* sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 pb-1 pt-3 [@media(max-height:820px)]:hidden">
          <CatWindowArt className="w-full" />
          <p className="mt-1 text-center font-display text-xs italic text-muted">{TAGLINE}</p>
        </div>
        <div className="space-y-0.5 border-t border-line px-3 py-3">
          <NavLink
            to="/configuracoes"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300' : 'text-muted hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            <Settings size={18} /> Configurações
          </NavLink>
          <button
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Modo dia' : 'Modo noturno'}
            <span className="ml-auto text-[10px] uppercase">{state.theme === 'system' ? 'auto' : ''}</span>
          </button>
        </div>
        <UserCard onNavigate={() => setOpen(false)} />
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* topo mobile */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={22} />
        </button>
        <Logo />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* ações flutuantes */}
      <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
        <NoteWidget />
        {!timer && (
          <button
            onClick={() => openTimer()}
            title="Cronômetro"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:scale-105 hover:bg-brand-700"
          >
            <Timer size={22} />
          </button>
        )}
      </div>

      <StudyModal />
      <TimerOverlay />
    </div>
  )
}

/** Rodapé da sidebar: quem está logado, estado do salvamento e sair */
function UserCard({ onNavigate }: { onNavigate: () => void }) {
  const me = useMe()
  const { logout } = useAuth()
  const { sync } = useStore()
  const [leaving, setLeaving] = useState(false)

  const leave = async () => {
    setLeaving(true)
    await sync.flush().catch(() => undefined)
    await logout()
  }

  return (
    <div className="flex items-center gap-1 border-t border-line px-3 py-3">
      <NavLink
        to="/perfil"
        onClick={onNavigate}
        className={({ isActive }) => clsx('flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition hover:bg-surface-2', isActive && 'bg-surface-2')}
      >
        <Avatar name={me.name} src={me.avatarUrl} className="h-9 w-9 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{me.name}</span>
          <SyncBadge />
        </span>
      </NavLink>
      <button
        onClick={leave}
        disabled={leaving}
        title="Sair"
        aria-label="Sair"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        <LogOut size={17} />
      </button>
    </div>
  )
}

/** Cabeçalho padrão das páginas: título + seletor de plano + ações */
export function PageHeader({ title, children, hidePlan }: { title: string; children?: ReactNode; hidePlan?: boolean }) {
  const { state, plan, setActivePlan, openStudy } = useStore()
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-line pb-4">
      <h1 className="mr-auto text-2xl font-bold tracking-tight">{title}</h1>
      {children}
      {!hidePlan && state.plans.length > 0 && (
        <select
          value={plan?.id ?? ''}
          onChange={(e) => setActivePlan(e.target.value)}
          className="field w-auto max-w-52 py-1.5 font-medium"
          aria-label="Plano ativo"
        >
          {state.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {!hidePlan && plan && (
        <button onClick={() => openStudy()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Adicionar estudo
        </button>
      )}
    </div>
  )
}
