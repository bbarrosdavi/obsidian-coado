import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { clsx } from '../lib/utils'
import { Art, type ArtName } from './art'

export function Card({ title, actions, className, children }: { title?: ReactNode; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-[0_2px_12px_-4px_rgba(60,40,20,0.12)]', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'bg-bad text-white hover:opacity-90',
        className,
      )}
    />
  )
}

export function IconButton({ title, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      {...props}
      title={title}
      aria-label={title}
      className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-ink', className)}
    />
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          'my-8 w-full rounded-2xl border border-line bg-surface shadow-2xl',
          size === 'sm' && 'max-w-md',
          size === 'md' && 'max-w-xl',
          size === 'lg' && 'max-w-3xl',
          size === 'xl' && 'max-w-5xl',
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color ?? 'var(--color-brand-600)' }} />
    </div>
  )
}

export function Empty({
  icon,
  art = 'books',
  title,
  children,
  action,
}: {
  icon?: ReactNode
  /** ilustração do tema; use 'none' para mostrar só o ícone */
  art?: ArtName
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {art !== 'none' ? <Art name={art} className="mb-2 h-28 w-auto" /> : icon && <div className="mb-1 text-brand-400">{icon}</div>}
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Número grande de destaque usado nos cards de resumo */
export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-3 text-3xl font-semibold tabular">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </Card>
  )
}

/** Abas simples estilo pill */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Bolinha/barra com a cor da disciplina */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={clsx('inline-block h-3 w-3 shrink-0 rounded-full', className)} style={{ background: color }} />
}

/** Acertos / erros / total / % em linha */
export function QuestionStats({ hits, misses }: { hits: number; misses: number }) {
  const total = hits + misses
  const p = total ? Math.round((hits / total) * 100) : 0
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-line text-xs tabular">
      <span className="px-2 py-1 text-ok" title="Acertos">{hits}</span>
      <span className="px-2 py-1 text-bad" title="Erros">{misses}</span>
      <span className="px-2 py-1" title="Total">{total}</span>
      <span className="bg-surface-2 px-2 py-1 font-semibold" title="Desempenho">{p}%</span>
    </div>
  )
}

export function confirmAction(message: string) {
  return window.confirm(message)
}
