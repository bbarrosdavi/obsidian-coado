import { createHash, randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Config } from '../config'
import type { Db, Pool } from '../db'
import { unauthorized } from '../errors'
import { toMe, type UserRow } from './users'

export const SESSION_COOKIE = 'coado_session'

/** Tipo da sessão: a do navegador (cookie) ou a de um aparelho pareado (token Bearer) */
export type SessionKind = 'web' | 'device'

const HOUR = 60 * 60 * 1000

export const hashToken = (token: string) => createHash('sha256').update(token).digest()

export function setSessionCookie(reply: FastifyReply, config: Config, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: Math.floor(config.sessionTtlMs / 1000),
  })
}

export function clearSessionCookie(reply: FastifyReply, config: Config) {
  reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies })
}

const ttlFor = (config: Config, kind: SessionKind) => (kind === 'device' ? config.deviceTtlMs : config.sessionTtlMs)

/** Abre uma sessão e devolve o token (o banco guarda só o hash). Vai no cookie ou, para aparelhos, no Bearer. */
export async function createSession(db: Db, config: Config, userId: string, userAgent: string | undefined, kind: SessionKind = 'web') {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `insert into sessions (token_hash, user_id, user_agent, kind, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [hashToken(token), userId, userAgent?.slice(0, 500) ?? null, kind, ttlFor(config, kind) / 1000],
  )
  return token
}

export async function deleteSessionByToken(db: Db, token: string) {
  await db.query('delete from sessions where token_hash = $1', [hashToken(token)])
}

export async function deleteExpiredSessions(db: Db) {
  const { rowCount } = await db.query('delete from sessions where expires_at <= now()')
  return rowCount ?? 0
}

/** Token de aparelho no cabeçalho `Authorization: Bearer …` (o relógio não tem cookies) */
export function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization
  if (typeof header !== 'string') return undefined
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : undefined
}

/**
 * Hook de autenticação: resolve o usuário pelo cookie (navegador) ou pelo Bearer (aparelho) e renova
 * a sessão de forma deslizante (atualiza last_seen a cada hora e estende a validade quando passou da metade).
 */
export function requireUser(pool: Pool, config: Config) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const bearer = bearerToken(request)
    const token = bearer ?? request.cookies[SESSION_COOKIE]
    if (!token) throw unauthorized()
    const { rows } = await pool.query<UserRow & { session_id: string; kind: SessionKind; last_seen_at: Date; expires_at: Date }>(
      `select s.id as session_id, s.kind, s.last_seen_at, s.expires_at,
              u.id, u.email, u.name, u.avatar_url, u.created_at, u.onboarded_at
         from sessions s join users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [hashToken(token)],
    )
    const row = rows[0]
    if (!row) {
      if (!bearer) clearSessionCookie(reply, config)
      throw unauthorized()
    }

    const ttl = ttlFor(config, row.kind)
    const now = Date.now()
    const extend = row.expires_at.getTime() - now < ttl / 2
    if (extend || now - row.last_seen_at.getTime() > HOUR) {
      await pool.query(
        `update sessions set last_seen_at = now(),
                expires_at = case when $2 then now() + make_interval(secs => $3) else expires_at end
          where id = $1`,
        [row.session_id, extend, ttl / 1000],
      )
      if (extend && row.kind === 'web' && !bearer) setSessionCookie(reply, config, token)
    }

    request.user = toMe(row)
    request.sessionId = row.session_id
    request.sessionKind = row.kind
  }
}
