import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { FilePatchSchema, IdSchema, type FileMeta, type FilesResponse } from '@coado/shared'
import type { FastifyInstance } from 'fastify'
import { pgCode, tx, type Db } from '../db'
import type { Deps } from '../deps'
import { badRequest, HttpError, notFound } from '../errors'
import { isUuid } from '../util'

/** Tipos exibidos no próprio navegador; o resto sempre baixa como anexo */
const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'])

interface FileRow {
  id: string
  name: string
  mime: string
  size: number
  plan_id: string | null
  subject_id: string | null
  storage_key: string
  created_at: Date
}

const toMeta = (f: FileRow): FileMeta => ({
  id: f.id,
  name: f.name,
  mime: f.mime,
  size: f.size,
  planId: f.plan_id,
  subjectId: f.subject_id,
  createdAt: f.created_at.toISOString(),
})

const COLUMNS = 'id, name, mime, size, plan_id, subject_id, storage_key, created_at'

export function sanitizeFileName(raw: string | undefined) {
  const name = basename((raw ?? '').replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return (name || 'arquivo').slice(0, 255)
}

/** Content-Disposition com nome ASCII de reserva + nome UTF-8 (RFC 5987/6266) */
function contentDisposition(type: 'inline' | 'attachment', name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

const usedBytes = async (db: Db, userId: string) => {
  const { rows } = await db.query<{ used: number }>('select coalesce(sum(size), 0)::bigint as used from files where user_id = $1', [userId])
  return rows[0].used
}

const tooLarge = (max: number) =>
  new HttpError(413, 'file_too_large', `O arquivo passa do limite de ${Math.round(max / 1024 / 1024)} MB.`)
const quotaExceeded = () => new HttpError(413, 'quota_exceeded', 'Seu espaço de arquivos está cheio. Apague algo para enviar mais.')
const invalidLink = () => badRequest('Plano ou disciplina não encontrado nesta conta.')

export async function fileRoutes(app: FastifyInstance, { config, pool, storage }: Deps) {
  const { maxFileSize, quota } = config.uploads

  const findFile = async (userId: string, id: string) => {
    if (!isUuid(id)) throw notFound('Arquivo')
    const { rows } = await pool.query<FileRow>(`select ${COLUMNS} from files where user_id = $1 and id = $2`, [userId, id])
    if (!rows[0]) throw notFound('Arquivo')
    return rows[0]
  }

  app.get('/files', async (request): Promise<FilesResponse> => {
    const { rows } = await pool.query<FileRow>(
      `select ${COLUMNS} from files where user_id = $1 order by created_at desc, id`,
      [request.user.id],
    )
    return {
      files: rows.map(toMeta),
      usage: { used: rows.reduce((sum, f) => sum + f.size, 0), quota, maxFileSize },
    }
  })

  app.post('/files', async (request, reply) => {
    const userId = request.user.id
    if ((await usedBytes(pool, userId)) >= quota) throw quotaExceeded()

    const id = randomUUID()
    const key = `${userId}/${id}`
    const fields: Record<string, string> = {}
    let file: { name: string; mime: string; size: number } | null = null

    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          if (typeof part.value === 'string') fields[part.fieldname] = part.value
          continue
        }
        if (file) {
          part.file.resume()
          continue
        }
        const size = await storage.save(part.file, key)
        if (part.file.truncated) throw tooLarge(maxFileSize)
        file = { name: sanitizeFileName(part.filename), mime: (part.mimetype || 'application/octet-stream').slice(0, 200), size }
      }
      if (!file) throw badRequest('Envie um arquivo no campo "file".')

      const link = (v: string | undefined) => {
        if (!v) return null
        const parsed = IdSchema.safeParse(v)
        if (!parsed.success) throw invalidLink()
        return parsed.data
      }
      const planId = link(fields.planId)
      const subjectId = link(fields.subjectId)
      const meta = file

      const row = await tx(pool, async (client) => {
        // serializa envios da mesma conta para a cota não estourar com uploads simultâneos
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [userId])
        if ((await usedBytes(client, userId)) + meta.size > quota) throw quotaExceeded()
        const { rows } = await client.query<FileRow>(
          `insert into files (id, user_id, plan_id, subject_id, name, mime, size, storage_key)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${COLUMNS}`,
          [id, userId, planId, subjectId, meta.name, meta.mime, meta.size, key],
        )
        return rows[0]
      })
      return reply.code(201).send(toMeta(row))
    } catch (err) {
      await storage.remove(key).catch(() => {})
      if (pgCode(err) === '23503') throw invalidLink()
      throw err
    }
  })

  app.patch<{ Params: { id: string } }>('/files/:id', async (request): Promise<FileMeta> => {
    const current = await findFile(request.user.id, request.params.id)
    const patch = FilePatchSchema.parse(request.body ?? {})
    try {
      const { rows } = await pool.query<FileRow>(
        `update files set name = $3, plan_id = $4, subject_id = $5 where user_id = $1 and id = $2 returning ${COLUMNS}`,
        [
          request.user.id,
          current.id,
          patch.name !== undefined ? sanitizeFileName(patch.name) : current.name,
          patch.planId !== undefined ? patch.planId : current.plan_id,
          patch.subjectId !== undefined ? patch.subjectId : current.subject_id,
        ],
      )
      return toMeta(rows[0])
    } catch (err) {
      if (pgCode(err) === '23503') throw invalidLink()
      throw err
    }
  })

  app.delete<{ Params: { id: string } }>('/files/:id', async (request, reply) => {
    const file = await findFile(request.user.id, request.params.id)
    await pool.query('delete from files where user_id = $1 and id = $2', [request.user.id, file.id])
    await storage.remove(file.storage_key)
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string }; Querystring: { download?: string } }>('/files/:id/content', async (request, reply) => {
    const file = await findFile(request.user.id, request.params.id)
    let stream
    try {
      stream = await storage.open(file.storage_key)
    } catch {
      throw notFound('Arquivo')
    }
    const inline = INLINE_TYPES.has(file.mime) && !request.query.download
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, max-age=0')
      .header('Content-Length', file.size)
    if (inline) {
      // sem CSP aqui: ela impediria o visualizador de PDF do navegador
      reply.removeHeader('Content-Security-Policy')
      reply.type(file.mime).header('Content-Disposition', contentDisposition('inline', file.name))
    } else {
      reply
        .type('application/octet-stream')
        .header('Content-Disposition', contentDisposition('attachment', file.name))
        .header('Content-Security-Policy', 'sandbox')
    }
    return reply.send(stream)
  })
}
