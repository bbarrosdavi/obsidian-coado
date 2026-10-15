import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance, InjectOptions } from 'fastify'
import { buildApp } from '../src/app'
import type { GoogleIdentity, OAuthClient } from '../src/auth/google'
import { loadConfig } from '../src/config'
import { createPool, type Pool } from '../src/db'
import { migrate } from '../src/migrate'

export const DB_URL = process.env.TEST_DATABASE_URL
if (!DB_URL) console.warn('TEST_DATABASE_URL não definida: testes de integração da api serão pulados.')

/** Cliente Google falso: o "code" recebido decide a identidade devolvida */
export function fakeOAuth(identities: Record<string, Partial<GoogleIdentity>> = {}): OAuthClient {
  return {
    authorizationUrl: ({ state, nonce, codeChallenge }) =>
      `https://accounts.google.test/auth?${new URLSearchParams({ state, nonce, code_challenge: codeChallenge })}`,
    async exchangeCode(code) {
      const id = identities[code]
      if (!id) throw new Error('code inválido')
      return { sub: code, email: `${code}@gmail.test`, emailVerified: true, name: code, picture: null, nonce: null, ...id }
    },
    // o "id_token" falso é o próprio nome da identidade; qualquer outro é recusado
    async verifyIdToken(idToken) {
      const id = identities[idToken]
      if (!id) throw new Error('id_token inválido')
      return { sub: idToken, email: `${idToken}@gmail.test`, emailVerified: true, name: idToken, picture: null, nonce: null, ...id }
    },
  }
}

export interface TestCtx {
  app: FastifyInstance
  pool: Pool
  uploadDir: string
  close: () => Promise<void>
}

export async function setup(env: Record<string, string> = {}, oauth: OAuthClient | null = fakeOAuth()): Promise<TestCtx> {
  const pool = createPool(DB_URL!)
  await pool.query('drop schema public cascade; create schema public')
  await migrate(pool)
  const uploadDir = await mkdtemp(join(tmpdir(), 'coado-uploads-'))
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: DB_URL,
    SESSION_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    AUTH_DEV_LOGIN: 'true',
    UPLOAD_DIR: uploadDir,
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    APP_URL: 'http://localhost:8080',
    ...env,
  })
  const app = await buildApp(config, pool, { logger: false, oauth })
  await app.ready()
  return {
    app,
    pool,
    uploadDir,
    close: async () => {
      await app.close()
      await pool.end()
      await rm(uploadDir, { recursive: true, force: true })
    },
  }
}

/** Extrai "nome=valor" de um Set-Cookie */
export function cookieFrom(res: { headers: Record<string, unknown> }, name: string): string | undefined {
  const raw = res.headers['set-cookie']
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : []
  const found = list.find((c: string) => c.startsWith(`${name}=`))
  return found?.split(';')[0]
}

/** Entra pelo login de desenvolvimento e devolve o cookie de sessão */
export async function devLogin(app: FastifyInstance, email = 'ana@coado.test', name = 'Ana') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/dev',
    headers: { 'x-coado-request': '1' },
    payload: { email, name },
  })
  if (res.statusCode !== 204) throw new Error(`login falhou: ${res.statusCode} ${res.body}`)
  return cookieFrom(res, 'coado_session')!
}

/** Cliente autenticado com o cabeçalho anti-CSRF */
export function client(app: FastifyInstance, cookie?: string) {
  const call = (method: InjectOptions['method'], url: string, payload?: unknown, extra: InjectOptions = {}) =>
    app.inject({
      method,
      url,
      payload: payload as InjectOptions['payload'],
      ...extra,
      headers: { 'x-coado-request': '1', ...(cookie && { cookie }), ...extra.headers },
    })
  return {
    get: (url: string) => call('GET', url),
    post: (url: string, body?: unknown, extra?: InjectOptions) => call('POST', url, body, extra),
    put: (url: string, body?: unknown) => call('PUT', url, body),
    patch: (url: string, body?: unknown) => call('PATCH', url, body),
    del: (url: string) => call('DELETE', url),
  }
}

/** Corpo multipart/form-data montado à mão para o inject */
export function multipart(fields: Record<string, string>, file?: { name: string; type: string; content: Buffer | string }) {
  const boundary = `----coado${Math.random().toString(16).slice(2)}`
  const chunks: Buffer[] = []
  for (const [k, v] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`))
  }
  if (file) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
      ),
      Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content),
      Buffer.from('\r\n'),
    )
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return { payload: Buffer.concat(chunks), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}
