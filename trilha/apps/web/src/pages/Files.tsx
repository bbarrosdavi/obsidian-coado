import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Download, ExternalLink, FileArchive, FileImage, FileSpreadsheet, FileText, File as FileIcon, Loader2, Pencil, Search, Trash2, UploadCloud } from 'lucide-react'
import type { FileMeta, FilesResponse, StorageUsage } from '@coado/shared'
import { PageHeader } from '../components/Layout'
import { Card, ColorDot, Empty, IconButton, confirmAction } from '../components/ui'
import { FilesArt } from '../components/study-art'
import { api, ApiError, uploadWithProgress } from '../lib/api'
import { useStore } from '../lib/store'
import { clsx, fmtBytes } from '../lib/utils'

const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'])

const contentUrl = (f: FileMeta, download = false) => `/api/files/${f.id}/content${download ? '?download=1' : ''}`

function kindOf(f: FileMeta) {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (f.mime.startsWith('image/')) return { icon: FileImage, label: 'imagem', tone: 'bg-[#a9bde0]/40' }
  if (f.mime === 'application/pdf' || ext === 'pdf') return { icon: FileText, label: 'PDF', tone: 'bg-[#e8a598]/40' }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: FileSpreadsheet, label: 'planilha', tone: 'bg-[#9cc3a0]/40' }
  if (['zip', 'rar', '7z'].includes(ext)) return { icon: FileArchive, label: 'compactado', tone: 'bg-[#c9b1d9]/40' }
  if (['doc', 'docx', 'odt', 'txt', 'md', 'rtf'].includes(ext)) return { icon: FileText, label: 'documento', tone: 'bg-[#f2cf8a]/40' }
  return { icon: FileIcon, label: ext || 'arquivo', tone: 'bg-surface-2' }
}

interface Upload {
  key: string
  name: string
  progress: number
  error?: string
}

export default function FilesPage() {
  const { plan, subjects, state } = useStore()
  const [files, setFiles] = useState<FileMeta[] | null>(null)
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loadError, setLoadError] = useState('')
  const [uploads, setUploads] = useState<Upload[]>([])
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<string>('')
  const [uploadSubject, setUploadSubject] = useState<string>('')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<FileMeta | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get<FilesResponse>('/files')
      setFiles(res.files)
      setUsage(res.usage)
      setLoadError('')
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const subjectById = useMemo(() => new Map(state.subjects.map((s) => [s.id, s])), [state.subjects])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (files ?? []).filter(
      (f) => (!q || f.name.toLowerCase().includes(q)) && (!subjectFilter || (subjectFilter === '-' ? !f.subjectId : f.subjectId === subjectFilter)),
    )
  }, [files, query, subjectFilter])

  const send = async (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
      if (usage && file.size > usage.maxFileSize) {
        setUploads((u) => [...u, { key, name: file.name, progress: 0, error: `maior que ${fmtBytes(usage.maxFileSize)}` }])
        continue
      }
      setUploads((u) => [...u, { key, name: file.name, progress: 0 }])
      const form = new FormData()
      if (plan) form.append('planId', plan.id)
      if (uploadSubject) form.append('subjectId', uploadSubject)
      form.append('file', file)
      try {
        const meta = await uploadWithProgress<FileMeta>('/files', form, (p) =>
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))),
        )
        setFiles((f) => [meta, ...(f ?? [])])
        setUsage((u) => (u ? { ...u, used: u.used + meta.size } : u))
        setUploads((u) => u.filter((x) => x.key !== key))
      } catch (e) {
        const msg = e instanceof ApiError && e.code === 'quota_exceeded' ? 'seu espaço acabou' : (e as Error).message
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: msg } : x)))
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) void send(e.dataTransfer.files)
  }

  const patch = async (f: FileMeta, body: { name?: string; subjectId?: string | null }) => {
    try {
      const updated = await api.patch<FileMeta>(`/files/${f.id}`, body)
      setFiles((list) => list?.map((x) => (x.id === f.id ? updated : x)) ?? null)
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const remove = async (f: FileMeta) => {
    if (!confirmAction(`Apagar "${f.name}"? O arquivo some da sua conta.`)) return
    try {
      await api.delete(`/files/${f.id}`)
      setFiles((list) => list?.filter((x) => x.id !== f.id) ?? null)
      setUsage((u) => (u ? { ...u, used: Math.max(0, u.used - f.size) } : u))
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const open = (f: FileMeta) => {
    if (f.mime.startsWith('image/') && INLINE.has(f.mime)) setPreview(f)
    else window.open(contentUrl(f, !INLINE.has(f.mime)), '_blank', 'noopener')
  }

  return (
    <>
      <PageHeader title="Arquivos" hidePlan />

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* área de envio */}
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'relative flex cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed p-6 text-center transition sm:flex-row sm:text-left',
            dragging ? 'scale-[1.01] border-brand-500 bg-brand-50 dark:bg-brand-600/10' : 'border-line bg-kraft/50 hover:border-brand-300',
          )}
        >
          <FilesArt className={clsx('h-28 w-auto shrink-0 transition', dragging && '-rotate-3 scale-105')} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">{dragging ? 'Pode soltar aqui ✉️' : 'Guarde seus materiais'}</p>
            <p className="mt-1 text-sm text-muted">
              Arraste PDFs, resumos, editais e imagens, ou clique para escolher.
              {usage && ` Até ${fmtBytes(usage.maxFileSize)} por arquivo.`}
            </p>
            {plan && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" onClick={(e) => e.preventDefault()}>
                <span className="text-muted">Guardar em</span>
                <span className="rounded-full bg-surface px-2 py-1 font-semibold">{plan.name}</span>
                <select
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  className="field w-auto py-1 text-xs"
                  aria-label="Disciplina dos novos arquivos"
                >
                  <option value="">sem disciplina</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white">
            <UploadCloud size={16} /> Enviar
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void send(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        <StorageMeter usage={usage} count={files?.length ?? 0} />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-4 space-y-2">
          {uploads.map((u) => (
            <li key={u.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2 text-sm">
              {u.error ? <span className="text-bad">✕</span> : <Loader2 size={14} className="animate-spin text-brand-500" />}
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.error ? (
                <>
                  <span className="text-xs text-bad">{u.error}</span>
                  <button className="text-xs text-muted hover:text-ink" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                    dispensar
                  </button>
                </>
              ) : (
                <span className="w-32">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="field pl-9" placeholder="Buscar pelo nome" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar arquivos" />
          </div>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="field w-auto" aria-label="Filtrar por disciplina">
            <option value="">Todas as disciplinas</option>
            <option value="-">Sem disciplina</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {loadError ? (
          <p className="py-8 text-center text-sm text-bad">
            {loadError}{' '}
            <button className="underline" onClick={() => void load()}>
              tentar de novo
            </button>
          </p>
        ) : files === null ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> abrindo a gaveta…
          </p>
        ) : visible.length === 0 ? (
          <Empty art="books" title={files.length ? 'Nada com esse filtro' : 'Gaveta vazia, por enquanto'}>
            {files.length ? 'Tente outra busca ou disciplina.' : 'Seus PDFs, resumos e editais aparecem aqui, guardados na sua conta.'}
          </Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((f) => (
              <FileCard
                key={f.id}
                file={f}
                subjectColor={f.subjectId ? subjectById.get(f.subjectId)?.color : undefined}
                subjects={subjects}
                onOpen={() => open(f)}
                onRename={(name) => patch(f, { name })}
                onSubject={(subjectId) => patch(f, { subjectId })}
                onDelete={() => remove(f)}
              />
            ))}
          </ul>
        )}
      </Card>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setPreview(null)} role="dialog" aria-label={preview.name}>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={contentUrl(preview)} alt={preview.name} className="max-h-[80vh] rounded-xl shadow-2xl" />
            <figcaption className="mt-3 flex items-center justify-between gap-3 text-sm text-white">
              <span className="truncate">{preview.name}</span>
              <a href={contentUrl(preview, true)} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 hover:bg-white/25">
                <Download size={14} /> baixar
              </a>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}

function FileCard({
  file,
  subjectColor,
  subjects,
  onOpen,
  onRename,
  onSubject,
  onDelete,
}: {
  file: FileMeta
  subjectColor?: string
  subjects: { id: string; name: string }[]
  onOpen: () => void
  onRename: (name: string) => void
  onSubject: (id: string | null) => void
  onDelete: () => void
}) {
  const kind = kindOf(file)
  const Icon = kind.icon
  const [editing, setEditing] = useState(false)
  const isImage = file.mime.startsWith('image/') && INLINE.has(file.mime)

  return (
    <li className="group flex gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:shadow-md">
      <button onClick={onOpen} className={clsx('relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg', kind.tone)} title="Abrir">
        {isImage ? <img src={contentUrl(file)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Icon size={24} className="text-ink/70" />}
        {/* cantinho dobrado */}
        <span className="absolute right-0 top-0 h-3 w-3 bg-gradient-to-bl from-bg to-transparent" />
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={file.name}
            className="field py-1"
            onBlur={(e) => {
              setEditing(false)
              const v = e.target.value.trim()
              if (v && v !== file.name) onRename(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label="Novo nome do arquivo"
          />
        ) : (
          <button onClick={onOpen} className="block w-full truncate text-left text-sm font-semibold hover:underline" title={file.name}>
            {file.name}
          </button>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {kind.label} · {fmtBytes(file.size)} · {new Date(file.createdAt).toLocaleDateString('pt-BR')}
        </p>
        <div className="mt-2 flex items-center gap-1">
          {subjectColor && <ColorDot color={subjectColor} className="h-2.5 w-2.5" />}
          <select
            value={file.subjectId ?? ''}
            onChange={(e) => onSubject(e.target.value || null)}
            className="min-w-0 flex-1 truncate rounded-md bg-transparent py-0.5 text-xs text-muted outline-none hover:bg-surface-2"
            aria-label={`Disciplina de ${file.name}`}
          >
            <option value="">sem disciplina</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <IconButton title="Renomear" onClick={() => setEditing(true)} className="h-7 w-7">
              <Pencil size={13} />
            </IconButton>
            {INLINE.has(file.mime) && !isImage && (
              <IconButton title="Abrir em nova aba" onClick={onOpen} className="h-7 w-7">
                <ExternalLink size={13} />
              </IconButton>
            )}
            <a href={contentUrl(file, true)} title="Baixar" aria-label="Baixar" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink">
              <Download size={13} />
            </a>
            <IconButton title="Apagar" onClick={onDelete} className="h-7 w-7 hover:text-bad">
              <Trash2 size={13} />
            </IconButton>
          </span>
        </div>
      </div>
    </li>
  )
}

/** Medidor de espaço: um anel com a fração usada */
function StorageMeter({ usage, count }: { usage: StorageUsage | null; count: number }) {
  const ratio = usage ? Math.min(1, usage.used / usage.quota) : 0
  return (
    <Card className="flex items-center gap-4">
      <svg viewBox="0 0 90 90" className="h-24 w-auto shrink-0" role="img" aria-label={`${Math.round(ratio * 100)}% do espaço usado`}>
        <circle cx="45" cy="45" r="34" fill="var(--color-brand-50)" stroke="var(--color-brand-100)" strokeWidth="12" />
        <circle cx="45" cy="45" r="34" fill="none" stroke="var(--color-brand-600)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - ratio)} transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 600ms' }} />
        <text x="45" y="50" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--app-ink)">{Math.round(ratio * 100)}%</text>
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Seu espaço</p>
        {usage ? (
          <>
            <p className="mt-1 text-xl font-semibold tabular">{fmtBytes(usage.used)}</p>
            <p className="text-xs text-muted">de {fmtBytes(usage.quota)} · {count} {count === 1 ? 'arquivo' : 'arquivos'}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">medindo…</p>
        )}
      </div>
    </Card>
  )
}
