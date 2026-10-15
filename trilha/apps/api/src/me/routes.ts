import { ProfilePatchSchema, type Me, type SessionInfo } from '@coado/shared'
import type { FastifyInstance } from 'fastify'
import { clearSessionCookie } from '../auth/sessions'
import { findUser, toMe } from '../auth/users'
import type { Deps } from '../deps'
import { notFound } from '../errors'
import { isUuid } from '../util'

export async function meRoutes(app: FastifyInstance, { config, pool, storage }: Deps) {
  app.get('/me', async (request): Promise<Me> => request.user)

  app.patch('/me', async (request): Promise<Me> => {
    const patch = ProfilePatchSchema.parse(request.body ?? {})
    const sets: string[] = []
    const values: unknown[] = [request.user.id]
    if (patch.name !== undefined) {
      values.push(patch.name)
      sets.push(`name = $${values.length}`)
    }
    if (patch.onboarded !== undefined) {
      sets.push(patch.onboarded ? 'onboarded_at = coalesce(onboarded_at, now())' : 'onboarded_at = null')
    }
    if (sets.length) await pool.query(`update users set ${sets.join(', ')}, updated_at = now() where id = $1`, values)
    const user = await findUser(pool, request.user.id)
    if (!user) throw notFound('Usuário')
    return toMe(user)
  })

  app.delete('/me', async (request, reply) => {
    // apaga a conta (cascata leva sessões, dados e metadados de arquivos) e depois os arquivos em disco
    await pool.query('delete from users where id = $1', [request.user.id])
    await storage.removePrefix(request.user.id)
    clearSessionCookie(reply, config)
    return reply.code(204).send()
  })

  app.get('/me/sessions', async (request): Promise<SessionInfo[]> => {
    const { rows } = await pool.query<{ id: string; created_at: Date; last_seen_at: Date; user_agent: string | null }>(
      `select id, created_at, last_seen_at, user_agent from sessions
        where user_id = $1 and expires_at > now() order by last_seen_at desc`,
      [request.user.id],
    )
    return rows.map((s) => ({
      id: s.id,
      createdAt: s.created_at.toISOString(),
      lastSeenAt: s.last_seen_at.toISOString(),
      userAgent: s.user_agent,
      current: s.id === request.sessionId,
    }))
  })

  app.delete('/me/sessions', async (request, reply) => {
    await pool.query('delete from sessions where user_id = $1 and id <> $2', [request.user.id, request.sessionId])
    return reply.code(204).send()
  })

  app.delete<{ Params: { id: string } }>('/me/sessions/:id', async (request, reply) => {
    if (!isUuid(request.params.id)) throw notFound('Sessão')
    const { rowCount } = await pool.query('delete from sessions where user_id = $1 and id = $2', [
      request.user.id,
      request.params.id,
    ])
    if (!rowCount) throw notFound('Sessão')
    if (request.params.id === request.sessionId) clearSessionCookie(reply, config)
    return reply.code(204).send()
  })
}
