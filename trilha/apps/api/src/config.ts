import { z } from 'zod'

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1' || v === 'yes')

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  APP_URL: z.url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET precisa de pelo menos 32 caracteres'),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  UPLOAD_MAX_FILE_MB: z.coerce.number().positive().default(25),
  UPLOAD_QUOTA_MB: z.coerce.number().positive().default(500),
  AUTH_DEV_LOGIN: bool,
  TRUST_PROXY: bool,
  SESSION_TTL_DAYS: z.coerce.number().positive().default(30),
  /** sessões de aparelhos pareados (relógio): não têm como refazer o login com frequência */
  DEVICE_SESSION_TTL_DAYS: z.coerce.number().positive().default(365),
})

export interface Config {
  env: 'development' | 'production' | 'test'
  port: number
  host: string
  logLevel: string
  databaseUrl: string
  /** origem pública do app, sem barra final */
  appUrl: string
  google: { clientId: string; clientSecret: string; redirectUri: string } | null
  sessionSecret: string
  /** cookies com Secure quando o app é servido por https */
  secureCookies: boolean
  sessionTtlMs: number
  /** validade das sessões de aparelhos pareados (Bearer) */
  deviceTtlMs: number
  devLogin: boolean
  trustProxy: boolean
  uploads: { dir: string; maxFileSize: number; quota: number }
}

const MB = 1024 * 1024

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  // variáveis vazias no .env contam como ausentes
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''))
  const parsed = EnvSchema.safeParse(clean)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuração inválida:\n${issues}`)
  }
  const e = parsed.data
  const appUrl = e.APP_URL.replace(/\/+$/, '')
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    appUrl,
    google:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET, redirectUri: `${appUrl}/api/auth/google/callback` }
        : null,
    sessionSecret: e.SESSION_SECRET,
    secureCookies: appUrl.startsWith('https://'),
    sessionTtlMs: e.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    deviceTtlMs: e.DEVICE_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    devLogin: e.AUTH_DEV_LOGIN && e.NODE_ENV !== 'production',
    trustProxy: e.TRUST_PROXY,
    uploads: { dir: e.UPLOAD_DIR, maxFileSize: Math.round(e.UPLOAD_MAX_FILE_MB * MB), quota: Math.round(e.UPLOAD_QUOTA_MB * MB) },
  }
}
