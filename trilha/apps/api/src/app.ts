import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { CSRF_HEADER, type Me } from '@coado/shared'
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify'
import { ZodError } from 'zod'
import { createGoogleClient, type OAuthClient } from './auth/google'
import { deviceRoutes } from './auth/device'
import { authRoutes } from './auth/routes'
import { deleteExpiredSessions, requireUser } from './auth/sessions'
import { deleteExpiredPairCodes } from './watch/pairing'
import type { Config } from './config'
import { dataRoutes } from './data/routes'
import { pgCode, type Pool } from './db'
import type { Deps } from './deps'
import { HttpError } from './errors'
import { fileRoutes } from './files/routes'
import { createDiskStorage, type Storage } from './files/storage'
import { meRoutes } from './me/routes'
import { watchPairRoutes, watchRoutes } from './watch/routes'

export interface AppOptions {
  /** substitui o cliente do Google (testes) */
  oauth?: OAuthClient | null
  storage?: Storage
  logger?: FastifyServerOptions['logger']
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const HOUR = 60 * 60 * 1000

/** Erros do Postgres que significam dado inválido vindo do cliente */
const PG_CLIENT_ERRORS: Record<string, [number, string, string]> = {
  '23503': [409, 'conflict', 'Algum registro aponta para um item que não existe mais nesta conta.'],
  '23514': [400, 'validation', 'Algum valor está fora do permitido.'],
  '22P02': [400, 'validation', 'Algum valor tem formato inválido.'],
  '22007': [400, 'validation', 'Alguma data é inválida.'],
  '22008': [400, 'validation', 'Alguma data está fora do intervalo permitido.'],
}

export async function buildApp(config: Config, pool: Pool, options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logLevel,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
  })

  const deps: Deps = {
    config,
    pool,
    oauth: options.oauth !== undefined ? options.oauth : config.google ? createGoogleClient(config.google) : null,
    storage: options.storage ?? createDiskStorage(config.uploads.dir),
  }

  // preenchidos por requireUser; declarados aqui para o Fastify manter o formato do objeto estável
  app.decorateRequest('user', null as unknown as Me)
  app.decorateRequest('sessionId', '')
  app.decorateRequest('sessionKind', 'web')

  await app.register(helmet, {
    // a api só devolve JSON e arquivos: nada de scripts, estilos ou frames
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
  await app.register(cookie, { secret: config.sessionSecret })
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' })
  await app.register(multipart, {
    throwFileSizeLimit: false,
    limits: { fileSize: config.uploads.maxFileSize, files: 1, fields: 10, fieldSize: 1024 },
  })

  // CSRF: só o próprio app manda este cabeçalho (outro site precisaria de CORS, que não liberamos)
  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return
    if (request.headers[CSRF_HEADER] !== '1') {
      return reply.code(403).send({ error: 'csrf', message: 'Requisição recusada (cabeçalho de segurança ausente).' })
    }
  })

  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof HttpError) return reply.code(err.statusCode).send(err.toBody())
    if (err instanceof ZodError) {
      const details = err.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message }))
      return reply.code(400).send({ error: 'validation', message: 'Dados inválidos.', details })
    }
    const pg = pgCode(err)
    if (pg && PG_CLIENT_ERRORS[pg]) {
      const [status, error, message] = PG_CLIENT_ERRORS[pg]
      request.log.info({ err }, 'dado recusado pelo banco')
      return reply.code(status).send({ error, message })
    }
    const status = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500
    if (status < 500) {
      const error = status === 413 ? 'payload_too_large' : status === 429 ? 'rate_limited' : 'bad_request'
      return reply.code(status).send({ error, message: err.message })
    }
    request.log.error({ err }, 'erro inesperado')
    return reply.code(500).send({ error: 'internal', message: 'Algo deu errado do nosso lado. Tente de novo.' })
  })

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'not_found', message: 'Rota não encontrada.' }))

  await app.register(
    async (api) => {
      api.get('/health', { config: { rateLimit: false } }, async (_request, reply) => {
        try {
          await pool.query('select 1')
          return { status: 'ok', db: 'ok' }
        } catch {
          return reply.code(503).send({ status: 'error', db: 'down' })
        }
      })

      await api.register(authRoutes, deps)
      // o relógio troca o código de pareamento por um token antes de ter sessão
      await api.register(watchPairRoutes, deps)

      // daqui para baixo, só com sessão válida
      await api.register(async (priv) => {
        priv.addHook('onRequest', requireUser(pool, config))
        await priv.register(deviceRoutes, deps)
        await priv.register(meRoutes, deps)
        await priv.register(dataRoutes, deps)
        await priv.register(fileRoutes, deps)
        await priv.register(watchRoutes, deps)
      })
    },
    { prefix: '/api' },
  )

  // limpeza de sessões vencidas: na subida e de hora em hora
  let timer: NodeJS.Timeout | undefined
  app.addHook('onReady', async () => {
    const clean = () =>
      Promise.all([deleteExpiredSessions(pool), deleteExpiredPairCodes(pool)]).catch((err: unknown) =>
        app.log.warn({ err }, 'falha ao limpar sessões e códigos vencidos'),
      )
    await clean()
    timer = setInterval(clean, HOUR)
    timer.unref()
  })
  app.addHook('onClose', async () => clearInterval(timer))

  return app
}
