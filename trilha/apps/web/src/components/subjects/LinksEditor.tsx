import { useState, type FormEvent } from 'react'
import { ExternalLink, Link2, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { ID, Topic, TopicLink } from '../../lib/types'
import { Button, IconButton, Modal } from '../ui'
import { normalizeUrl } from './stats'

/** Lista de links de um tópico com formulário para adicionar */
export function LinksEditor({ topic }: { topic: Topic }) {
  const { saveTopic } = useStore()
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const save = (links: TopicLink[]) => saveTopic({ ...topic, links })

  const add = (e: FormEvent) => {
    e.preventDefault()
    const u = normalizeUrl(url)
    if (!u) {
      setError('Informe um endereço válido (http ou https).')
      return
    }
    save([...topic.links, { title: title.trim() || u, url: u }])
    setTitle('')
    setUrl('')
    setError('')
  }

  return (
    <div className="space-y-3">
      {topic.links.length === 0 ? (
        <p className="text-sm text-muted">Nenhum link cadastrado.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {topic.links.map((l, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2">
              <Link2 size={14} className="shrink-0 text-muted" />
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-brand-600 hover:underline dark:text-brand-300"
                title={l.url}
              >
                {l.title}
              </a>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink" title="Abrir">
                <ExternalLink size={14} />
              </a>
              <IconButton title="Remover link" onClick={() => save(topic.links.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <input className="field sm:w-48!" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="field flex-1"
          placeholder="https://…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
        />
        <Button type="submit" variant="secondary" disabled={!url.trim()}>
          <Plus size={16} /> Adicionar
        </Button>
      </form>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  )
}

/** Modal para ver/adicionar links de um tópico (lê o tópico atualizado do store) */
export function LinksModal({ topicId, onClose }: { topicId: ID; onClose: () => void }) {
  const { state } = useStore()
  const topic = state.topics.find((t) => t.id === topicId)
  if (!topic) return null
  return (
    <Modal open onClose={onClose} title={`Links · ${topic.name}`}>
      <LinksEditor topic={topic} />
    </Modal>
  )
}
