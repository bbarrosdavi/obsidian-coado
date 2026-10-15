import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Database, Download, Monitor, Moon, Plus, RotateCcw, Sun, Trash2, Upload, Watch } from 'lucide-react'
import type { PairCode } from '@coado/shared'
import { PageHeader } from '../components/Layout'
import { Button, Card, confirmAction, IconButton } from '../components/ui'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { AppState, TimerPrefs } from '../lib/types'
import { cachedPalette, choosePalette, type Palette } from '../lib/legacy'
import { BRAND, BRAND_SLUG } from '../lib/brand'
import { clsx, today, uid } from '../lib/utils'

const THEMES: { value: AppState['theme']; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Claro', icon: <Sun size={18} /> },
  { value: 'dark', label: 'Escuro', icon: <Moon size={18} /> },
  { value: 'system', label: 'Automático', icon: <Monitor size={18} /> },
]

/** Prévia de cada paleta: cada amostra mostra as próprias cores, não as da paleta ativa (ver index.css).
 *  A escolha vale só para esta instância (navegador ou aparelho): não vai para a conta. */
const PALETTES: { value: Palette; label: string; accent: string; light: string; dark: string }[] = [
  { value: 'cafe', label: 'Âmbar', accent: '#ad7a4a', light: '#f4ece1', dark: '#1b1410' },
  { value: 'grafite', label: 'Grafite', accent: '#5b6d83', light: '#f3f4f6', dark: '#121418' },
  { value: 'oceano', label: 'Oceano', accent: '#2a84ad', light: '#eef4f7', dark: '#0d171d' },
  { value: 'floresta', label: 'Floresta', accent: '#47844d', light: '#f1f4ee', dark: '#10150f' },
  { value: 'ameixa', label: 'Ameixa', accent: '#7f58b8', light: '#f4f1f7', dark: '#141019' },
  { value: 'magenta', label: 'Magenta', accent: '#cf2f7c', light: '#f8f1f4', dark: '#170f13' },
]

const TIMER_FIELDS: { key: Exclude<keyof TimerPrefs, 'sound'>; label: string; suffix: string; max: number }[] = [
  { key: 'pomodoroStudy', label: 'Pomodoro: estudo', suffix: 'min', max: 180 },
  { key: 'pomodoroShort', label: 'Pausa curta', suffix: 'min', max: 60 },
  { key: 'pomodoroLong', label: 'Pausa longa', suffix: 'min', max: 120 },
  { key: 'pomodoroRounds', label: 'Rodadas até a pausa longa', suffix: '', max: 12 },
  { key: 'countdown', label: 'Temporizador', suffix: 'min', max: 600 },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" hidePlan />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <AppearanceSection />
          <DataSection />
          <AboutSection />
        </div>
        <div className="space-y-6">
          <CategoriesSection />
          <TimerSection />
          <WatchSection />
        </div>
      </div>
    </>
  )
}

function AppearanceSection() {
  const { state, setTheme } = useStore()
  const [palette, setPaletteState] = useState<Palette>(cachedPalette)
  const setPalette = (p: Palette) => {
    choosePalette(p)
    setPaletteState(p)
  }
  return (
    <Card title="Aparência">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const active = state.theme === t.value
          return (
            <button
              key={t.value}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(t.value)}
              className={clsx(
                'flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-sm font-medium transition',
                active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-300' : 'border-line text-muted hover:text-ink',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>
      <p className="mt-5 mb-1 text-sm font-medium text-ink">Paleta</p>
      <p className="mb-2 text-xs text-muted">Vale só para este aparelho.</p>
      <div role="radiogroup" aria-label="Paleta" className="grid grid-cols-3 gap-2">
        {PALETTES.map((p) => {
          const active = palette === p.value
          return (
            <button
              key={p.value}
              role="radio"
              aria-checked={active}
              onClick={() => setPalette(p.value)}
              className={clsx(
                'flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition',
                active ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-300' : 'border-line text-muted hover:text-ink',
              )}
            >
              <span aria-hidden className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-line">
                <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: p.light }} />
                <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: p.dark }} />
                <span className="absolute inset-2 rounded-full" style={{ background: p.accent }} />
              </span>
              {p.label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

const isBackup = (v: unknown): v is AppState => {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return Array.isArray(o.plans) && Array.isArray(o.subjects) && Array.isArray(o.studies)
}

function DataSection() {
  const { state, importState, resetAll } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${BRAND_SLUG}-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ ok: true, text: 'Backup exportado.' })
  }

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isBackup(data)) throw new Error('invalid')
      if (!confirmAction(`Importar "${file.name}"? Todos os dados atuais serão substituídos.`)) return
      setMessage({ ok: true, text: 'Importando…' })
      await importState(data)
      setMessage({ ok: true, text: `Backup importado: ${data.plans.length} plano(s), ${data.studies.length} estudo(s).` })
    } catch (err) {
      const invalid = err instanceof SyntaxError || (err as Error).message === 'invalid'
      setMessage({ ok: false, text: invalid ? `Arquivo inválido. Selecione um backup .json exportado pelo ${BRAND}.` : (err as Error).message })
    }
  }

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn()
      setMessage({ ok: true, text: done })
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message })
    }
  }

  const restoreSample = () => {
    if (!confirmAction('Carregar o plano de exemplo? Todos os dados atuais da conta serão substituídos.')) return
    void run(() => resetAll(true), 'Plano de exemplo carregado.')
  }

  const eraseAll = () => {
    if (!confirmAction('Apagar todos os dados? Esta ação não pode ser desfeita.')) return
    if (!confirmAction('Tem certeza absoluta? Planos, estudos, revisões e simulados serão apagados.')) return
    void run(() => resetAll(false), 'Todos os dados foram apagados.')
  }

  return (
    <Card title="Dados">
      <div className="space-y-3">
        <DataRow title="Exportar backup" desc="Baixe um arquivo .json com todos os seus dados.">
          <Button variant="secondary" size="sm" onClick={exportBackup}>
            <Download size={14} /> Exportar backup (.json)
          </Button>
        </DataRow>
        <DataRow title="Importar backup" desc="Substitui os dados da conta pelos do arquivo.">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Importar backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
        </DataRow>
        <DataRow title="Dados de exemplo" desc="Substitui tudo pelo plano de exemplo (Petrobrás).">
          <Button variant="secondary" size="sm" onClick={restoreSample}>
            <RotateCcw size={14} /> Carregar exemplo
          </Button>
        </DataRow>
        <DataRow title="Apagar tudo" desc="Remove planos, estudos e revisões da sua conta (arquivos e perfil ficam).">
          <Button variant="danger" size="sm" onClick={eraseAll}>
            <Trash2 size={14} /> Apagar tudo
          </Button>
        </DataRow>
      </div>
      {message && <p className={clsx('mt-4 text-sm', message.ok ? 'text-ok' : 'text-bad')}>{message.text}</p>}
    </Card>
  )
}

function DataRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function CategoriesSection() {
  const { state, update } = useStore()
  const [name, setName] = useState('')

  const rename = (id: string, value: string) => {
    const n = value.trim()
    if (!n) return
    update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, name: n } : c)) }))
  }

  const remove = (id: string, label: string) => {
    const used = state.studies.filter((s) => s.categoryId === id).length
    const msg = used
      ? `Remover a categoria "${label}"? ${used} estudo(s) passarão para a categoria Teoria.`
      : `Remover a categoria "${label}"?`
    if (!confirmAction(msg)) return
    update((s) => ({
      ...s,
      categories: s.categories.filter((c) => c.id !== id),
      studies: s.studies.map((x) => (x.categoryId === id ? { ...x, categoryId: 'teoria' } : x)),
    }))
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    update((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: n }] }))
    setName('')
  }

  return (
    <Card title="Categorias de estudo">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {state.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            {c.builtin ? (
              <>
                <span className="flex-1 py-1.5 text-sm">{c.name}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">padrão</span>
              </>
            ) : (
              <>
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    if (e.target.value.trim()) rename(c.id, e.target.value)
                    else e.target.value = c.name
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="field flex-1 border-transparent bg-transparent py-1.5 hover:border-line"
                  aria-label={`Nome da categoria ${c.name}`}
                />
                <IconButton title="Remover categoria" onClick={() => remove(c.id, c.name)} className="hover:text-bad">
                  <Trash2 size={16} />
                </IconButton>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className="field" placeholder="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nova categoria" />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          <Plus size={14} /> Adicionar
        </Button>
      </form>
    </Card>
  )
}

function TimerSection() {
  const { state, update } = useStore()
  const prefs = state.timerPrefs
  const set = (patch: Partial<TimerPrefs>) => update((s) => ({ ...s, timerPrefs: { ...s.timerPrefs, ...patch } }))

  return (
    <Card title="Relógio">
      <div className="grid gap-4 sm:grid-cols-2">
        {TIMER_FIELDS.map((f) => (
          <NumberField key={f.key} label={f.label} suffix={f.suffix} max={f.max} value={prefs[f.key]} onCommit={(v) => set({ [f.key]: v })} />
        ))}
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={prefs.sound} onChange={(e) => set({ sound: e.target.checked })} />
        Tocar som ao fim de cada etapa
      </label>
    </Card>
  )
}

/** Campo numérico que só grava valores válidos (permite apagar o conteúdo enquanto digita) */
function NumberField({
  label,
  suffix,
  max,
  value,
  onCommit,
}: {
  label: string
  suffix: string
  max: number
  value: number
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = `nf-${label}`
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={1}
          max={max}
          className="field"
          value={draft ?? value}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = Math.round(Number(e.target.value))
            if (e.target.value !== '' && n >= 1 && n <= max) onCommit(n)
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
    </div>
  )
}

/** Pareamento do app de relógio (apps/watch): código curto, de uso único, que vira um token de aparelho */
function WatchSection() {
  const [code, setCode] = useState<PairCode | null>(null)
  const [left, setLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    const tick = () => {
      const s = Math.max(0, Math.round((Date.parse(code.expiresAt) - Date.now()) / 1000))
      setLeft(s)
      if (s === 0) setCode(null)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [code])

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      setCode(await api.post<PairCode>('/watch/pair-code'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Relógio">
      <div className="flex gap-3">
        <Watch size={18} className="mt-0.5 shrink-0 text-brand-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">
            O {BRAND} para Wear OS roda o pomodoro no pulso, puxa a próxima sessão do ciclo e registra os estudos nesta conta.
          </p>
          {code ? (
            <div className="mt-3 rounded-xl border border-dashed border-brand-400 bg-brand-50 p-4 text-center dark:bg-brand-600/10">
              <p className="label">Código de pareamento</p>
              <p className="font-display text-4xl font-bold tracking-[0.3em] tabular">{code.code}</p>
              <p className="mt-1 text-xs text-muted">
                vale por {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} · no relógio: Ajustes → Conta → Parear
              </p>
            </div>
          ) : (
            <Button size="sm" className="mt-3" onClick={generate} disabled={busy}>
              <Watch size={14} /> Gerar código de pareamento
            </Button>
          )}
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          <p className="mt-3 text-xs text-muted">O relógio aparece em Perfil → “Onde você está conectado”. Encerrar a sessão dele por lá o despareia.</p>
        </div>
      </div>
    </Card>
  )
}

function AboutSection() {
  return (
    <Card title="Sobre">
      <div className="flex gap-3">
        <Database size={18} className="mt-0.5 shrink-0 text-brand-500" />
        <p className="text-sm text-muted">Seus dados ficam guardados na sua conta e sincronizam entre os aparelhos em que você entrar. O backup .json continua disponível para quando quiser uma cópia.</p>
      </div>
    </Card>
  )
}
