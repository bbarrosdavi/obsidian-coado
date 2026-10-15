import { createRemoteJWKSet, jwtVerify } from 'jose'

/** Dados da conta Google extraídos do id_token já verificado */
export interface GoogleIdentity {
  sub: string
  email: string
  emailVerified: boolean
  name: string
  picture: string | null
  nonce: string | null
}

/** Chamadas ao Google isoladas aqui para poderem ser simuladas nos testes */
export interface OAuthClient {
  authorizationUrl(params: { state: string; codeChallenge: string; nonce: string }): string
  /** Troca o code pelo id_token e o valida (assinatura, emissor, audiência, validade) */
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity>
  /** Valida um id_token obtido no aparelho (Sign in with Google do Android) */
  verifyIdToken(idToken: string): Promise<GoogleIdentity>
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export function createGoogleClient(cfg: { clientId: string; clientSecret: string; redirectUri: string }): OAuthClient {
  const jwks = createRemoteJWKSet(new URL(JWKS_URL))

  const verify = async (idToken: string): Promise<GoogleIdentity> => {
    const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUERS, audience: cfg.clientId })
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('id_token incompleto')
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email.split('@')[0],
      picture: typeof payload.picture === 'string' ? payload.picture : null,
      nonce: typeof payload.nonce === 'string' ? payload.nonce : null,
    }
  }

  return {
    authorizationUrl({ state, codeChallenge, nonce }) {
      const url = new URL(AUTH_URL)
      url.search = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString()
      return url.toString()
    },

    async exchangeCode(code, codeVerifier) {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: cfg.redirectUri,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`Google respondeu ${res.status} na troca do code`)
      const body = (await res.json()) as { id_token?: string }
      if (!body.id_token) throw new Error('Resposta do Google sem id_token')
      return verify(body.id_token)
    },

    verifyIdToken: verify,
  }
}
