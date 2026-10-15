import { mkdir } from 'node:fs/promises'
import { buildApp } from './app'
import { loadConfig } from './config'
import { createPool } from './db'

const config = loadConfig()
const pool = createPool(config.databaseUrl)
await mkdir(config.uploads.dir, { recursive: true })

const app = await buildApp(config, pool)

if (!config.google) app.log.warn('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes: login com Google desativado')
if (config.devLogin) app.log.warn('AUTH_DEV_LOGIN ativo: qualquer pessoa pode entrar sem senha. Não use em produção!')

let closing = false
const shutdown = async (signal: string) => {
  if (closing) return
  closing = true
  app.log.info(`${signal} recebido, encerrando…`)
  try {
    await app.close()
    await pool.end()
  } finally {
    process.exit(0)
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  await pool.end()
  process.exit(1)
}
