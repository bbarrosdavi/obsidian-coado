import 'fastify'
import type { Me } from '@coado/shared'
import type { SessionKind } from './auth/sessions'

declare module 'fastify' {
  interface FastifyRequest {
    /** preenchido pelo hook requireUser nas rotas autenticadas */
    user: Me
    sessionId: string
    /** navegador (cookie) ou aparelho pareado (Bearer) */
    sessionKind: SessionKind
  }
}
