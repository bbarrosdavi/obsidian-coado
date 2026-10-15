import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, Laptop, Loader2, LogOut, Pencil, Smartphone, Sparkles, Trash2, Watch } from 'lucide-react'
import { BRAND } from '../lib/brand'
import type { SessionInfo, StorageUsage, FilesResponse } from '@coado/shared'
import { PageHeader } from '../components/Layout'
import { Button, Card, Modal } from '../components/ui'
import { Avatar } from '../components/account'
import { useWelcome } from '../components/welcome/Welcome'
import { api } from '../lib/api'
import { firstName, useAuth, useMe } from '../lib/auth'
import { useStore } from '../lib/store'
import { addDays, clsx, fmtBytes, fmtDuration, today } from '../lib/utils'

const LOYALTY_DAYS = 10

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Perfil" hidePlan />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <IdentityCard />
          <LoyaltyCard />
          <NumbersCard />
        </div>
        <div className="space-y-6">
          <SessionsCard />
          <DangerCard />
        </div>
      </div>
    </>
  )
}

function IdentityCard() {
  const me = useMe()
  const { updateProfile } = useAuth()
  const { openWelcome } = useWelcome()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(me.name)
  const [saving, setSaving] = useState(false)
  const since = new Date(me.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const save = async () => {
    const n = name.trim()
    if (!n || n === me.name) return setEditing(false)
    setSaving(true)
    try {
      await updateProfile({ name: n })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-100 via-surface to-surface p-6 dark:from-brand-900/60">
      <div className="relative flex flex-wrap items-center gap-5">
        <Avatar name={me.name} src={me.avatarUrl} className="h-20 w-20 text-2xl shadow-md" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <input autoFocus className="field max-w-xs" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} aria-label="Seu nome" />
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar
              </Button>
            </form>
          ) : (
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              {me.name}
              <button onClick={() => setEditing(true)} className="text-muted hover:text-ink" title="Editar nome" aria-label="Editar nome">
                <Pencil size={15} />
              </button>
            </h2>
          )}
          <p className="text-sm text-muted">{me.email}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold">
            <CalendarDays size={13} className="text-brand-600" /> estudando desde {since}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openWelcome}>
          <Sparkles size={14} /> Rever apresentação
        </Button>
      </div>
    </section>
  )
}

/** Cartão de constância: um carimbo por dia com estudo nos últimos 10 dias */
function LoyaltyCard() {
  const me = useMe()
  const { state } = useStore()
  const days = useMemo(() => {
    const studied = new Set(state.studies.map((s) => s.date))
    return Array.from({ length: LOYALTY_DAYS }, (_, i) => {
      const date = addDays(today(), i - LOYALTY_DAYS + 1)
      return { date, stamped: studied.has(date) }
    })
  }, [state.studies])
  const stamps = days.filter((d) => d.stamped).length

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-dashed border-brand-300 bg-kraft/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">cartão de constância</p>
          <p className="font-display text-xl font-bold">Dez dias de {firstName(me.name)}</p>
        </div>
        <p className="font-display text-3xl font-bold tabular text-brand-700 dark:text-brand-300">
          {stamps}
          <span className="text-base text-muted">/{LOYALTY_DAYS}</span>
        </p>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {days.map((d, i) => (
          <li key={d.date} className="flex flex-col items-center gap-1" title={`${d.date.split('-').reverse().join('/')}${d.stamped ? ' · estudou' : ''}`}>
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 transition',
                d.stamped ? 'rotate-[-8deg] border-brand-600 bg-brand-600 text-white shadow-sm animate-pop' : 'border-dashed border-brand-300 text-brand-300',
              )}
              style={d.stamped ? { animationDelay: `${i * 60}ms` } : undefined}
            >
              <Check size={16} />
            </span>
            <span className="text-[10px] text-muted tabular">{d.date.slice(8)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted">
        {stamps === LOYALTY_DAYS
          ? 'Cartão completo! Dez dias seguidos de estudo.'
          : 'Cada dia com estudo registrado ganha um carimbo. Complete o cartão estudando dez dias seguidos.'}
      </p>
    </section>
  )
}

function NumbersCard() {
  const { state } = useStore()
  const [storage, setStorage] = useState<{ usage: StorageUsage; files: number } | null>(null)

  useEffect(() => {
    api
      .get<FilesResponse>('/files')
      .then((r) => setStorage({ usage: r.usage, files: r.files.length }))
      .catch(() => undefined)
  }, [])

  const t = useMemo(() => {
    const seconds = state.studies.reduce((a, s) => a + s.duration, 0)
    const hits = state.studies.reduce((a, s) => a + s.hits, 0)
    const total = state.studies.reduce((a, s) => a + s.hits + s.misses, 0)
    return { seconds, hits, total, days: new Set(state.studies.map((s) => s.date)).size }
  }, [state.studies])

  const items = [
    { label: 'Tempo de estudo', value: fmtDuration(t.seconds) },
    { label: 'Dias estudados', value: t.days },
    { label: 'Sessões', value: state.studies.length },
    { label: 'Questões', value: t.total.toLocaleString('pt-BR'), sub: t.total ? `${Math.round((t.hits / t.total) * 100)}% de acerto` : undefined },
    { label: 'Planos', value: state.plans.length },
    { label: 'Arquivos', value: storage?.files ?? '–', sub: storage ? fmtBytes(storage.usage.used) : undefined },
  ]

  return (
    <Card title="Sua história por aqui">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-2xl bg-surface-2 p-3">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{i.label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular">{i.value}</dd>
            {i.sub && <dd className="text-xs text-muted">{i.sub}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  )
}

/** "Chrome · Windows" a partir do user-agent */
function describeAgent(ua: string | null) {
  if (!ua) return { label: 'Navegador desconhecido', mobile: false, watch: false }
  // sessão de aparelho pareado (apps/watch): "Coado Watch (modelo)"
  const watch = /^Coado Watch(?: \((.+)\))?/.exec(ua)
  if (watch) return { label: `Relógio ${BRAND}${watch[1] ? ` · ${watch[1]}` : ''}`, mobile: false, watch: true }
  // app do celular (apps/android/phone): "Coado Android (marca modelo)"
  const phone = /^Coado Android(?: \((.+)\))?/.exec(ua)
  if (phone) return { label: `Celular ${BRAND}${phone[1] ? ` · ${phone[1]}` : ''}`, mobile: true, watch: false }
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Mobi|Android|iPhone/.test(ua), watch: false }
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 2) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} dia(s)`
}

function SessionsCard() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    api
      .get<SessionInfo[]>('/me/sessions')
      .then(setSessions)
      .catch((e: Error) => setError(e.message))

  useEffect(() => {
    void load()
  }, [])

  const revoke = async (id?: string) => {
    try {
      await api.delete(id ? `/me/sessions/${id}` : '/me/sessions')
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const others = sessions?.filter((s) => !s.current).length ?? 0

  return (
    <Card
      title="Onde você está conectado"
      actions={
        others > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void revoke()}>
            <LogOut size={13} /> Sair dos outros
          </Button>
        )
      }
    >
      {error && <p className="mb-2 text-sm text-bad">{error}</p>}
      {!sessions ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> carregando…
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const a = describeAgent(s.userAgent)
            const Icon = a.watch ? Watch : a.mobile ? Smartphone : Laptop
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {a.label}
                    {s.current && <span className="ml-2 rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-bold uppercase text-ok">este aparelho</span>}
                  </p>
                  <p className="text-xs text-muted">ativo {ago(s.lastSeenAt)} · desde {new Date(s.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" onClick={() => void revoke(s.id)}>
                    Encerrar
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function DangerCard() {
  const me = useMe()
  const { deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteAccount()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Card title="Fechar a conta">
      <p className="text-sm text-muted">
        Apaga sua conta, todos os planos, o histórico de estudos e os arquivos guardados. Não dá para desfazer; se quiser, exporte um backup em Configurações antes.
      </p>
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 size={14} /> Apagar minha conta
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Apagar a conta de vez?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Melhor não
            </Button>
            <Button variant="danger" onClick={() => void confirm()} disabled={busy || typed.trim().toLowerCase() !== me.email.toLowerCase()}>
              {busy && <Loader2 size={14} className="animate-spin" />} Apagar tudo
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Para confirmar, digite seu e-mail <strong>{me.email}</strong>.
        </p>
        <input className="field mt-3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={me.email} aria-label="Confirme seu e-mail" autoComplete="off" />
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </Modal>
    </Card>
  )
}
