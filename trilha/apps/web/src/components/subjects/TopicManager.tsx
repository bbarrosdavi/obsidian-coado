import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Link2, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../lib/store'
import type { ID, Subject } from '../../lib/types'
import { clsx, fmtDate, pct } from '../../lib/utils'
import { Button, ColorDot, IconButton, Modal, ProgressBar, QuestionStats, confirmAction } from '../ui'
import { LinksEditor } from './LinksEditor'
import { statsBy, stripBullet } from './stats'

/** Gerenciador de tópicos de uma disciplina (modal) */
export function TopicManager({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { studies, topicsOf, saveTopic, deleteTopic, setTopicFinished, reorderTopics } = useStore()
  const topics = topicsOf(subject.id)
  const stats = useMemo(() => statsBy(studies, (s) => s.topicId), [studies])

  const [newName, setNewName] = useState('')
  const [bulk, setBulk] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: ID; name: string } | null>(null)
  const [linksOf, setLinksOf] = useState<ID | null>(null)

  const done = topics.filter((t) => t.finished).length
  const bulkLines = (bulk ?? '').split(/\r?\n/).map(stripBullet).filter(Boolean)

  const add = () => {
    const name = newName.trim()
    if (!name) return
    saveTopic({ name, subjectId: subject.id })
    setNewName('')
  }

  const addBulk = () => {
    for (const name of bulkLines) saveTopic({ name, subjectId: subject.id })
    setBulk(null)
  }

  const move = (index: number, dir: -1 | 1) => {
    const ids = topics.map((t) => t.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    reorderTopics(subject.id, ids)
  }

  const commitRename = () => {
    const name = editing?.name.trim()
    if (editing && name) saveTopic({ id: editing.id, name, subjectId: subject.id })
    setEditing(null)
  }

  const remove = (id: ID, name: string) => {
    if (confirmAction(`Excluir o tópico "${name}"? Os estudos vinculados continuarão na disciplina, sem tópico.`)) deleteTopic(id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <ColorDot color={subject.color} /> {subject.name}
        </span>
      }
      footer={<Button onClick={onClose}>Concluir</Button>}
    >
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={pct(done, topics.length)} />
        <span className="shrink-0 text-sm text-muted tabular">
          {done}/{topics.length} concluídos
        </span>
      </div>

      {topics.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">
          Nenhum tópico ainda. Adicione abaixo.
        </p>
      ) : (
        <ol className="space-y-2">
          {topics.map((t, i) => {
            const st = stats.get(t.id)
            const isEditing = editing?.id === t.id
            return (
              <li key={t.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={t.finished}
                    onChange={(e) => setTopicFinished(t.id, e.target.checked)}
                    aria-label="Tópico concluído"
                  />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="field py-1!"
                        value={editing.name}
                        onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setEditing(null)
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={clsx('text-left text-sm font-medium hover:text-brand-600', t.finished && 'text-muted line-through')}
                        onClick={() => setEditing({ id: t.id, name: t.name })}
                        title="Clique para renomear"
                      >
                        <span className="mr-1.5 text-muted tabular">{i + 1}.</span>
                        {t.name}
                      </button>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>
                        {st?.count ?? 0} {st?.count === 1 ? 'estudo' : 'estudos'}
                      </span>
                      <span>Último: {st?.last ? fmtDate(st.last) : '-'}</span>
                      {st && st.hits + st.misses > 0 && <QuestionStats hits={st.hits} misses={st.misses} />}
                      {t.links.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Link2 size={12} /> {t.links.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end">
                    <IconButton title="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30">
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton
                      title="Mover para baixo"
                      disabled={i === topics.length - 1}
                      onClick={() => move(i, 1)}
                      className="disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </IconButton>
                    <IconButton
                      title="Links"
                      onClick={() => setLinksOf(linksOf === t.id ? null : t.id)}
                      className={clsx(linksOf === t.id && 'bg-surface-2 text-ink')}
                    >
                      <Link2 size={15} />
                    </IconButton>
                    <IconButton title="Renomear" onClick={() => setEditing({ id: t.id, name: t.name })}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton title="Excluir tópico" onClick={() => remove(t.id, t.name)} className="hover:text-bad">
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
                {linksOf === t.id && (
                  <div className="mt-3 border-t border-line pt-3 sm:ml-7">
                    <LinksEditor topic={t} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-5 space-y-3 border-t border-line pt-4">
        <div className="flex gap-2">
          <input
            className="field"
            placeholder="Novo tópico (Enter para adicionar)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button variant="secondary" onClick={add} disabled={!newName.trim()}>
            <Plus size={16} /> Adicionar
          </Button>
        </div>
        {bulk === null ? (
          <Button variant="ghost" size="sm" onClick={() => setBulk('')}>
            <ListPlus size={14} /> Adicionar vários
          </Button>
        ) : (
          <div className="space-y-2">
            <label className="label" htmlFor="bulk-topics">
              Adicionar vários (um tópico por linha)
            </label>
            <textarea
              id="bulk-topics"
              autoFocus
              rows={6}
              className="field font-mono text-xs!"
              placeholder={'Concordância verbal\nRegência\nCrase'}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto text-xs text-muted">{bulkLines.length} tópico(s)</span>
              <Button variant="ghost" size="sm" onClick={() => setBulk(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={addBulk} disabled={!bulkLines.length}>
                Adicionar {bulkLines.length || ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
