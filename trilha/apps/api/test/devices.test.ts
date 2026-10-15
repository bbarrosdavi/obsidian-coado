import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { client, cookieFrom, DB_URL, fakeOAuth, setup, type TestCtx } from './helpers'

describe.skipIf(!DB_URL)('apps: sessão de aparelho', () => {
  let ctx: TestCtx
  let token = ''

  const bearer = (t = token) => ({ 'x-coado-request': '1', authorization: `Bearer ${t}` })

  beforeAll(async () => {
    ctx = await setup({}, fakeOAuth({ joana: { name: 'Joana' }, naoverificado: { emailVerified: false } }))
  })
  afterAll(() => ctx?.close())

  it('informa o client id do Google para o app', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/config' })
    expect(res.json()).toEqual({ google: true, devLogin: true, googleClientId: 'client-id' })
  })

  it('Sign in with Google nativo: id_token vira sessão de aparelho', async () => {
    const res = await client(ctx.app).post('/api/auth/google/token', { idToken: 'joana', device: 'Pixel 9' })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ me: { name: 'Joana', email: 'joana@gmail.test' } })
    token = res.json().token
    expect(cookieFrom(res, 'coado_session')).toBeUndefined()

    const me = await ctx.app.inject({ method: 'GET', url: '/api/me', headers: bearer() })
    expect(me.statusCode).toBe(200)
    expect(me.json().name).toBe('Joana')

    const sessions = (await ctx.app.inject({ method: 'GET', url: '/api/me/sessions', headers: bearer() })).json()
    expect(sessions.find((s: { current: boolean }) => s.current).userAgent).toBe('Coado Android (Pixel 9)')
  })

  it('recusa id_token inválido e e-mail não verificado', async () => {
    const bad = await client(ctx.app).post('/api/auth/google/token', { idToken: 'forjado' })
    expect(bad.statusCode).toBe(401)
    expect(bad.json().error).toBe('id_token')
    const unverified = await client(ctx.app).post('/api/auth/google/token', { idToken: 'naoverificado' })
    expect(unverified.statusCode).toBe(403)
    expect((await client(ctx.app).post('/api/auth/google/token', {})).statusCode).toBe(400)
  })

  it('o app abre a sessão web da WebView com o Bearer', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/web-session?returnTo=/planejamento', headers: bearer() })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/planejamento')
    const cookie = cookieFrom(res, 'coado_session')!
    expect(cookie).toBeTruthy()
    const me = await client(ctx.app, cookie).get('/api/me')
    expect(me.statusCode).toBe(200)
    expect(me.json().email).toBe('joana@gmail.test')

    // um navegador comum (cookie) não abre sessões por aqui
    const fromWeb = await client(ctx.app, cookie).get('/api/auth/web-session')
    expect(fromWeb.statusCode).toBe(403)
  })

  it('o visitante também entra no app (só em desenvolvimento)', async () => {
    const res = await client(ctx.app).post('/api/auth/dev/token', { name: 'Dev', email: 'dev@coado.test', device: 'Emulador' })
    expect(res.statusCode).toBe(201)
    expect(res.json().me).toEqual({ name: 'Dev', email: 'dev@coado.test' })
  })

  it('logout pelo Bearer encerra a sessão do aparelho', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer() })
    expect(res.statusCode).toBe(204)
    expect((await ctx.app.inject({ method: 'GET', url: '/api/me', headers: bearer() })).statusCode).toBe(401)
  })
})

describe.skipIf(!DB_URL)('apps: sem Google configurado', () => {
  let ctx: TestCtx
  beforeAll(async () => {
    ctx = await setup({ AUTH_DEV_LOGIN: 'false' }, null)
  })
  afterAll(() => ctx?.close())

  it('explica que o login nativo não está disponível', async () => {
    const res = await client(ctx.app).post('/api/auth/google/token', { idToken: 'x' })
    expect(res.statusCode).toBe(503)
    expect((await client(ctx.app).post('/api/auth/dev/token', {})).statusCode).toBe(404)
    expect((await ctx.app.inject({ method: 'GET', url: '/api/auth/config' })).json().googleClientId).toBeNull()
  })
})
