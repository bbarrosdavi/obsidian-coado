import { AppStateSchema, sanitizeState, SyncRequestSchema, type AppState, type SyncResponse } from '@coado/shared'
import type { FastifyInstance } from 'fastify'
import { tx } from '../db'
import type { Deps } from '../deps'
import { applySync, loadState, replaceState } from './repo'

/** Lotes e backups podem ser grandes; o zod limita a quantidade de linhas */
const BIG_BODY = 15 * 1024 * 1024

export async function dataRoutes(app: FastifyInstance, { pool }: Deps) {
  app.get('/state', async (request): Promise<AppState> => {
    // leitura num snapshot único para não misturar tabelas de momentos diferentes
    const client = await pool.connect()
    try {
      await client.query('begin isolation level repeatable read read only')
      const state = await loadState(client, request.user.id)
      await client.query('commit')
      return state
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  })

  app.post('/sync', { bodyLimit: BIG_BODY }, async (request): Promise<SyncResponse> => {
    const req = SyncRequestSchema.parse(request.body)
    await tx(pool, (client) => applySync(client, request.user.id, req))
    return { ok: true, syncedAt: new Date().toISOString() }
  })

  app.put('/state', { bodyLimit: BIG_BODY }, async (request): Promise<AppState> => {
    const state = sanitizeState(AppStateSchema.parse(request.body))
    return tx(pool, async (client) => {
      await replaceState(client, request.user.id, state)
      return loadState(client, request.user.id)
    })
  })
}
