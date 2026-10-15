import { createHash, randomBytes } from 'node:crypto'
import type { AuthConfig, AuthErrorCode, PairResponse } from '@coado/shared'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { Deps } from '../deps'
import { HttpError, notFound } from '../errors'
import { bearerToken, clearSessionCookie, createSession, deleteSessionByToken, SESSION_COOKIE, setSessionCookie } from './sessions'
import { ensureUser } from './users'

const OAUTH_COOKIE = 'coado_oauth'
const OAUTH_COOKIE_PATH = '/api/auth'

const random = (bytes = 32) => randomBytes(bytes).toString('base64url')
const s256 = (v: string) => createHash('sha256').update(v).digest('base64url')

/** Só aceita caminhos internos (evita open redirect para outro domínio) */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 500) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/'
  return value
}

const OAuthCookieSchema = z.object({ state: z.string(), verifier: z.string(), nonce: z.string(), returnTo: z.string() })

const CallbackQuery = z.object({
  code: z.string().max(2000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(200).optional(),
})

const DevLoginBody = z.object({
  name: z.string().trim().min(1).max(120).default('Visitante'),
  email: z.email().max(200).default('dev@coado.local'),
})

/** nome do aparelho, para a lista "Onde você está conectado" */
const Device = z.string().trim().min(1).max(120).default('Aparelho')

const GoogleTokenBody = z.object({ idToken: z.string().min(1).max(4096), device: Device })
const DevTokenBody = DevLoginBody.extend({ device: Device })

const authLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } }

export async function authRoutes(app: FastifyInstance, { config, pool, oauth }: Deps) {
  const cookieOpts = { path: OAUTH_COOKIE_PATH, httpOnly: true, sameSite: 'lax' as const, secure: config.secureCookies }

  const fail = (reply: FastifyReply, code: AuthErrorCode) => reply.redirect(`/?authError=${code}`)

  app.get('/auth/config', async (): Promise<AuthConfig> => ({
    google: !!oauth,
    devLogin: config.devLogin,
    // o app Android pede o id_token ao Google com este client id (o mesmo da web: a audiência bate)
    googleClientId: oauth ? (config.google?.clientId ?? null) : null,
  }))

  /** Sessão de aparelho (Bearer) a partir de uma identidade já verificada */
  const deviceSession = async (identity: Parameters<typeof ensureUser>[1], device: string, reply: FastifyReply) => {
    const user = await ensureUser(pool, identity)
    const token = await createSession(pool, config, user.id, `Coado Android (${device})`, 'device')
    const res: PairResponse = {
      token,
      me: { name: user.name, email: user.email },
      expiresAt: new Date(Date.now() + config.deviceTtlMs).toISOString(),
    }
    return reply.code(201).send(res)
  }

  // Login nativo do app Android: o Sign in with Google entrega um id_token no aparelho; a api o
  // valida (assinatura, emissor, audiência) e abre uma sessão de aparelho, sem cookie
  app.post('/auth/google/token', { config: authLimit }, async (request, reply) => {
    if (!oauth) throw new HttpError(503, 'config', 'O login com Google não está configurado neste servidor.')
    const body = GoogleTokenBody.parse(request.body ?? {})
    let identity
    try {
      identity = await oauth.verifyIdToken(body.idToken)
    } catch (err) {
      request.log.warn({ err }, 'id_token recusado')
      throw new HttpError(401, 'id_token', 'O Google não confirmou este login. Tente de novo.')
    }
    if (!identity.emailVerified) throw new HttpError(403, 'email', 'Sua conta Google precisa ter o e-mail verificado.')
    return deviceSession({ googleSub: identity.sub, email: identity.email, name: identity.name, avatarUrl: identity.picture }, body.device, reply)
  })

  // o mesmo visitante do navegador, para o app no emulador (sem Google Play)
  app.post('/auth/dev/token', { config: authLimit }, async (request, reply) => {
    if (!config.devLogin) throw notFound('Rota')
    const body = DevTokenBody.parse(request.body ?? {})
    return deviceSession({ googleSub: `dev:${body.email}`, email: body.email, name: body.name, avatarUrl: null }, body.device, reply)
  })

  app.get('/auth/google', { config: authLimit }, async (request, reply) => {
    if (!oauth) return fail(reply, 'config')
    const { returnTo } = request.query as { returnTo?: unknown }
    const flow = { state: random(), verifier: random(48), nonce: random(), returnTo: safeReturnTo(returnTo) }
    reply.setCookie(OAUTH_COOKIE, JSON.stringify(flow), { ...cookieOpts, signed: true, maxAge: 600 })
    return reply.redirect(oauth.authorizationUrl({ state: flow.state, nonce: flow.nonce, codeChallenge: s256(flow.verifier) }))
  })

  app.get('/auth/google/callback', { config: authLimit }, async (request, reply) => {
    if (!oauth) return fail(reply, 'config')
    const query = CallbackQuery.safeParse(request.query)

    // o cookie do fluxo vale para uma única tentativa
    const raw = request.cookies[OAUTH_COOKIE]
    reply.clearCookie(OAUTH_COOKIE, cookieOpts)
    const unsigned = raw ? request.unsignCookie(raw) : null
    let flow: z.infer<typeof OAuthCookieSchema> | null = null
    if (unsigned?.valid && unsigned.value) {
      try {
        flow = OAuthCookieSchema.parse(JSON.parse(unsigned.value))
      } catch {
        flow = null
      }
    }

    if (!query.success) return fail(reply, 'state')
    if (query.data.error) return fail(reply, 'denied')
    if (!flow || !query.data.state || query.data.state !== flow.state || !query.data.code) return fail(reply, 'state')

    let identity
    try {
      identity = await oauth.exchangeCode(query.data.code, flow.verifier)
    } catch (err) {
      request.log.warn({ err }, 'falha ao trocar o code do Google')
      return fail(reply, 'exchange')
    }
    if (identity.nonce !== flow.nonce) return fail(reply, 'state')
    if (!identity.emailVerified) return fail(reply, 'email')

    const user = await ensureUser(pool, {
      googleSub: identity.sub,
      email: identity.email,
      name: identity.name,
      avatarUrl: identity.picture,
    })
    const token = await createSession(pool, config, user.id, request.headers['user-agent'])
    setSessionCookie(reply, config, token)
    return reply.redirect(safeReturnTo(flow.returnTo))
  })

  app.post('/auth/dev', { config: authLimit }, async (request, reply) => {
    if (!config.devLogin) throw notFound('Rota')
    const body = DevLoginBody.parse(request.body ?? {})
    const user = await ensureUser(pool, { googleSub: `dev:${body.email}`, email: body.email, name: body.name, avatarUrl: null })
    const token = await createSession(pool, config, user.id, request.headers['user-agent'])
    setSessionCookie(reply, config, token)
    return reply.code(204).send()
  })

  app.post('/auth/logout', async (request, reply) => {
    // o navegador sai pelo cookie; o app, pelo Bearer
    const token = bearerToken(request) ?? request.cookies[SESSION_COOKIE]
    if (token) await deleteSessionByToken(pool, token)
    clearSessionCookie(reply, config)
    return reply.code(204).send()
  })
}
