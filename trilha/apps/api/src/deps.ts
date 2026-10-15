import type { OAuthClient } from './auth/google'
import type { Config } from './config'
import type { Pool } from './db'
import type { Storage } from './files/storage'

/** Dependências compartilhadas pelas rotas */
export interface Deps {
  config: Config
  pool: Pool
  /** null quando o login com Google não está configurado */
  oauth: OAuthClient | null
  storage: Storage
}
