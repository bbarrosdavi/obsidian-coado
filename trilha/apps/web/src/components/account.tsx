import { useState } from 'react'
import { AlertTriangle, CloudOff, RefreshCcw } from 'lucide-react'
import { useStore } from '../lib/store'
import { clsx } from '../lib/utils'
import type { SyncStatus } from '../lib/sync'

/** Foto da conta Google, com iniciais quando não houver (ou falhar) */
export function Avatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return src && !broken ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={clsx('shrink-0 rounded-full object-cover ring-2 ring-surface', className)}
    />
  ) : (
    <span className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white ring-2 ring-surface', className)} aria-hidden>
      {initials || '☕'}
    </span>
  )
}

const LABELS: Record<SyncStatus, string> = {
  saved: 'tudo salvo',
  pending: 'coando…',
  saving: 'salvando…',
  offline: 'sem conexão',
  error: 'não salvou',
}

/** Estado da sincronização com a conta */
export function SyncBadge({ className }: { className?: string }) {
  const { sync } = useStore()
  const { status } = sync
  const problem = status === 'offline' || status === 'error'

  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[11px] font-semibold', problem ? 'text-bad' : 'text-muted', className)} role="status" title={sync.errorMessage || undefined}>
      {status === 'offline' ? (
        <CloudOff size={12} />
      ) : status === 'error' ? (
        <AlertTriangle size={12} />
      ) : (
        <span className={clsx('h-1.5 w-1.5 rounded-full', status === 'saved' ? 'bg-ok' : 'animate-pulse bg-warn')} />
      )}
      {LABELS[status]}
      {problem && (
        <button
          onClick={() => (status === 'error' ? void sync.reload() : sync.retry())}
          className="ml-0.5 inline-flex items-center gap-1 rounded px-1 underline-offset-2 hover:underline"
          title={status === 'error' ? 'Descartar alterações locais e recarregar da conta' : 'Tentar de novo'}
        >
          <RefreshCcw size={11} />
          {status === 'error' ? 'recarregar' : 'tentar'}
        </button>
      )}
    </span>
  )
}
