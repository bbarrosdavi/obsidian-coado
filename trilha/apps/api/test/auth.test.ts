import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { safeReturnTo } from '../src/auth/routes'
import { client, cookieFrom, DB_URL, devLogin, fakeOAuth, setup, type TestCtx } from './helpers'

describe('safeReturnTo', () => {
  it('aceita só caminhos internos', () => {
    expect(safeReturnTo('/planos?x=1')).toBe('/planos?x=1')
    expect(safeReturnTo('//evil.com')).toBe('/')
    expect(safeReturnTo('/\\evil.com')).toBe('/')
    expect(safeReturnTo('https://evil.com')).toBe('/')
    expect(safeReturnTo('/a\nb')).toBe('/')
    expect(safeReturnTo(undefined)).toBe('/')
  })
})

describe.skipIf(!DB_URL)('auth', () => {
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await setup({}, fakeOAuth({ joana: { name: 'Joana' } }))
  })
  afterAll(() => ctx?.close())

  /** Inicia o fluxo e devolve o cookie assinado com state/nonce/PKCE */
  async function startGoogle() {
    const start = await ctx.app.inject({ method: 'GET', url: '/api/auth/google' })
    expect(start.statusCode).toBe(302)
    const location = new URL(start.headers.location as string)
    expect(location.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    const flowCookie = cookieFrom(start, 'coado_oauth')!
    expect(flowCookie).toBeTruthy()
    return flowCookie
  }

  it('recusa escrita sem o cabeçalho anti-CSRF', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('csrf')
  })

  it('exige sessão nas rotas privadas', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'unauthorized' })
    const bad = await ctx.app.inject({ method: 'GET', url: '/api/state', headers: { cookie: 'coado_session=invalido' } })
    expect(bad.statusCode).toBe(401)
  })

  it('informa os métodos de login disponíveis', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/config' })
    expect(res.json()).toEqual({ google: true, devLogin: true, googleClientId: 'client-id' })
  })

  it('login de desenvolvimento cria a conta com padrões', async () => {
    const cookie = await devLogin(ctx.app, 'dev1@coado.test', 'Dev Um')
    const me = await client(ctx.app, cookie).get('/api/me')
    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({ email: 'dev1@coado.test', name: 'Dev Um', avatarUrl: null, onboardedAt: null })

    const state = (await client(ctx.app, cookie).get('/api/state')).json()
    expect(state.categories.map((c: { id: string }) => c.id).sort()).toEqual(['questoes', 'revisao', 'teoria'])
    expect(state.timerPrefs.pomodoroStudy).toBe(25)
    expect(state.reviewIntervals).toEqual([1, 7, 30, 60, 120])
    expect(state.plans).toEqual([])
  })

  it('callback do Google com state errado é recusado', async () => {
    const flowCookie = await startGoogle()
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=joana&state=forjado',
      headers: { cookie: flowCookie },
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/?authError=state')
    expect(cookieFrom(res, 'coado_session')).toBeUndefined()
  })

  it('callback sem o cookie do fluxo é recusado', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/google/callback?code=joana&state=x' })
    expect(res.headers.location).toBe('/?authError=state')
  })

  it('usuário que negou acesso volta com authError=denied', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/google/callback?error=access_denied' })
    expect(res.headers.location).toBe('/?authError=denied')
  })
})

describe.skipIf(!DB_URL)('auth: fluxo completo do Google', () => {
  // o nonce é sorteado no /auth/google; o cliente falso devolve o último nonce visto
  let lastNonce = ''
  let ctx: TestCtx

  beforeAll(async () => {
    ctx = await setup(
      {},
      {
        authorizationUrl: ({ state, nonce }) => {
          lastNonce = nonce
          return `https://accounts.google.test/auth?state=${state}`
        },
        async exchangeCode(code) {
          if (code === 'quebrado') throw new Error('falhou')
          return {
            sub: `google-${code}`,
            email: `${code}@gmail.test`,
            emailVerified: code !== 'naoverificado',
            name: code === 'joana' ? 'Joana' : code,
            picture: 'https://lh3.googleusercontent.com/foto',
            nonce: code === 'outronce' ? 'diferente' : lastNonce,
          }
        },
        async verifyIdToken() {
          throw new Error('não usado neste teste')
        },
      },
    )
  })
  afterAll(() => ctx?.close())

  async function flow(code: string, returnTo?: string) {
    const start = await ctx.app.inject({
      method: 'GET',
      url: `/api/auth/google${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`,
    })
    const state = new URL(start.headers.location as string).searchParams.get('state')!
    return ctx.app.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=${code}&state=${state}`,
      headers: { cookie: cookieFrom(start, 'coado_oauth')! },
    })
  }

  it('cria usuário e sessão e volta para a rota pedida', async () => {
    const res = await flow('joana', '/estatisticas')
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/estatisticas')
    const cookie = cookieFrom(res, 'coado_session')!
    expect(cookie).toBeTruthy()
    const setCookie = String(res.headers['set-cookie'])
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/SameSite=Lax/)

    const me = (await client(ctx.app, cookie).get('/api/me')).json()
    expect(me).toMatchObject({ name: 'Joana', email: 'joana@gmail.test', avatarUrl: 'https://lh3.googleusercontent.com/foto' })

    const { rows } = await ctx.pool.query('select count(*)::int as n from categories where user_id = $1', [me.id])
    expect(rows[0].n).toBe(3)
  })

  it('segundo login reaproveita a conta e mantém o nome editado', async () => {
    const first = cookieFrom(await flow('joana'), 'coado_session')!
    await client(ctx.app, first).patch('/api/me', { name: 'Jô' })
    const again = cookieFrom(await flow('joana'), 'coado_session')!
    const me = (await client(ctx.app, again).get('/api/me')).json()
    expect(me.name).toBe('Jô')
    const { rows } = await ctx.pool.query("select count(*)::int as n from users where email = 'joana@gmail.test'")
    expect(rows[0].n).toBe(1)
  })

  it('recusa e-mail não verificado, nonce trocado e falha na troca', async () => {
    expect((await flow('naoverificado')).headers.location).toBe('/?authError=email')
    expect((await flow('outronce')).headers.location).toBe('/?authError=state')
    expect((await flow('quebrado')).headers.location).toBe('/?authError=exchange')
  })

  it('returnTo externo vira /', async () => {
    expect((await flow('joana', '//evil.com/x')).headers.location).toBe('/')
  })
})

describe.skipIf(!DB_URL)('perfil e sessões', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await setup()
  })
  afterAll(() => ctx?.close())

  it('marca e desmarca as boas-vindas', async () => {
    const api = client(ctx.app, await devLogin(ctx.app))
    const on = (await api.patch('/api/me', { onboarded: true })).json()
    expect(on.onboardedAt).toEqual(expect.any(String))
    const again = (await api.patch('/api/me', { onboarded: true })).json()
    expect(again.onboardedAt).toBe(on.onboardedAt)
    const off = (await api.patch('/api/me', { onboarded: false })).json()
    expect(off.onboardedAt).toBeNull()
    expect((await api.patch('/api/me', { name: '' })).statusCode).toBe(400)
  })

  it('lista e encerra sessões', async () => {
    const a = await devLogin(ctx.app, 'multi@coado.test')
    const b = await devLogin(ctx.app, 'multi@coado.test')
    const c = await devLogin(ctx.app, 'multi@coado.test')
    const list = (await client(ctx.app, a).get('/api/me/sessions')).json()
    expect(list).toHaveLength(3)
    expect(list.filter((s: { current: boolean }) => s.current)).toHaveLength(1)

    const other = list.find((s: { current: boolean }) => !s.current)
    expect((await client(ctx.app, a).del(`/api/me/sessions/${other.id}`)).statusCode).toBe(204)
    expect((await client(ctx.app, a).del('/api/me/sessions/nao-e-uuid')).statusCode).toBe(404)

    expect((await client(ctx.app, a).del('/api/me/sessions')).statusCode).toBe(204)
    expect((await client(ctx.app, a).get('/api/me')).statusCode).toBe(200)
    expect((await client(ctx.app, b).get('/api/me')).statusCode).toBe(401)
    expect((await client(ctx.app, c).get('/api/me')).statusCode).toBe(401)
  })

  it('logout encerra a sessão', async () => {
    const cookie = await devLogin(ctx.app, 'sair@coado.test')
    const res = await client(ctx.app, cookie).post('/api/auth/logout')
    expect(res.statusCode).toBe(204)
    expect((await client(ctx.app, cookie).get('/api/me')).statusCode).toBe(401)
  })

  it('health responde', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/health' })
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' })
  })

  it('rota desconhecida dá 404 em JSON', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/nada' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('not_found')
  })
})

describe.skipIf(!DB_URL)('login de desenvolvimento desligado', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await setup({ AUTH_DEV_LOGIN: 'false' }, null)
  })
  afterAll(() => ctx?.close())

  it('não existe e o Google aparece como indisponível', async () => {
    const res = await client(ctx.app).post('/api/auth/dev', {})
    expect(res.statusCode).toBe(404)
    expect((await ctx.app.inject({ method: 'GET', url: '/api/auth/config' })).json()).toEqual({ google: false, devLogin: false, googleClientId: null })
    const google = await ctx.app.inject({ method: 'GET', url: '/api/auth/google' })
    expect(google.headers.location).toBe('/?authError=config')
  })
})
