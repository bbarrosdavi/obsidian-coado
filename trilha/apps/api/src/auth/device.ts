import type { FastifyInstance } from 'fastify'
import type { Deps } from '../deps'
import { HttpError } from '../errors'
import { safeReturnTo } from './routes'
import { createSession, setSessionCookie } from './sessions'

/**
 * Rotas de aparelhos já autenticados (Bearer).
 *
 * O app Android mostra o site numa WebView, que fala com a api por cookie como qualquer navegador.
 * Em vez de refazer o login do Google lá dentro (o Google recusa WebViews), o app carrega esta rota
 * com o Bearer dele: ela abre uma sessão web, grava o cookie e redireciona para o app.
 */
export async function deviceRoutes(app: FastifyInstance, { config, pool }: Deps) {
  app.get('/auth/web-session', async (request, reply) => {
    if (request.sessionKind !== 'device') throw new HttpError(403, 'forbidden', 'Só um aparelho pareado abre sessão web por aqui.')
    const { returnTo } = request.query as { returnTo?: unknown }
    const token = await createSession(pool, config, request.user.id, `${request.headers['user-agent'] ?? ''} (WebView)`.trim(), 'web')
    setSessionCookie(reply, config, token)
    return reply.redirect(safeReturnTo(returnTo))
  })
}
