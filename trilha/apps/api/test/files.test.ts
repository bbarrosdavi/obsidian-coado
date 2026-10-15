import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileMeta, FilesResponse } from '@coado/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sanitizeFileName } from '../src/files/routes'
import { client, DB_URL, devLogin, multipart, setup, type TestCtx } from './helpers'

describe('sanitizeFileName', () => {
  it('remove caminhos e caracteres de controle', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\Users\\x\\resumo.pdf')).toBe('resumo.pdf')
    expect(sanitizeFileName('a\u0000b.txt')).toBe('ab.txt')
    expect(sanitizeFileName('')).toBe('arquivo')
  })
})

const KB = 1024

describe.skipIf(!DB_URL)('arquivos', () => {
  let ctx: TestCtx
  let cookie: string
  let api: ReturnType<typeof client>

  // limite de 10 KB por arquivo e 20 KB por conta
  beforeAll(async () => {
    ctx = await setup({ UPLOAD_MAX_FILE_MB: String(10 / 1024), UPLOAD_QUOTA_MB: String(20 / 1024) })
    cookie = await devLogin(ctx.app)
    api = client(ctx.app, cookie)
    await api.post('/api/sync', {
      upserts: {
        plans: [{ id: 'p1', name: 'Plano', weeklyGoal: { minutes: 0, questions: 0 }, createdAt: '2026-01-01T00:00:00Z' }],
        subjects: [{ id: 's1', planId: 'p1', name: 'Direito', color: '#000', order: 0 }],
      },
    })
  })
  afterAll(() => ctx?.close())

  const upload = (fields: Record<string, string>, file?: Parameters<typeof multipart>[1], who = api) => {
    const body = multipart(fields, file)
    return who.post('/api/files', body.payload, { headers: body.headers })
  }

  let pdf: FileMeta

  it('envia, lista e baixa um PDF vinculado à disciplina', async () => {
    const res = await upload({ planId: 'p1', subjectId: 's1' }, { name: 'edital ção.pdf', type: 'application/pdf', content: Buffer.alloc(4 * KB, 1) })
    expect(res.statusCode).toBe(201)
    pdf = res.json()
    expect(pdf).toMatchObject({ name: 'edital ção.pdf', mime: 'application/pdf', size: 4 * KB, planId: 'p1', subjectId: 's1' })

    const list: FilesResponse = (await api.get('/api/files')).json()
    expect(list.files).toHaveLength(1)
    expect(list.usage).toEqual({ used: 4 * KB, quota: 20 * KB, maxFileSize: 10 * KB })

    const content = await api.get(`/api/files/${pdf.id}/content`)
    expect(content.statusCode).toBe(200)
    expect(content.headers['content-type']).toBe('application/pdf')
    expect(content.headers['content-disposition']).toMatch(/^inline; filename="edital __o.pdf"; filename\*=UTF-8''edital%20%C3%A7%C3%A3o\.pdf$/)
    expect(content.headers['x-content-type-options']).toBe('nosniff')
    expect(content.headers['content-security-policy']).toBeUndefined()
    expect(content.rawPayload.length).toBe(4 * KB)

    const download = await api.get(`/api/files/${pdf.id}/content?download=1`)
    expect(download.headers['content-disposition']).toMatch(/^attachment;/)
    expect(download.headers['content-type']).toBe('application/octet-stream')
  })

  it('HTML nunca é servido inline', async () => {
    const res = await upload({}, { name: 'x.html', type: 'text/html', content: '<script>alert(1)</script>' })
    expect(res.statusCode).toBe(201)
    const html: FileMeta = res.json()
    const content = await api.get(`/api/files/${html.id}/content`)
    expect(content.headers['content-type']).toBe('application/octet-stream')
    expect(content.headers['content-disposition']).toMatch(/^attachment;/)
    expect(content.headers['content-security-policy']).toBe('sandbox')
    await api.del(`/api/files/${html.id}`)
  })

  it('recusa arquivo acima do limite e não deixa lixo no disco', async () => {
    const res = await upload({}, { name: 'grande.bin', type: 'application/octet-stream', content: Buffer.alloc(12 * KB) })
    expect(res.statusCode).toBe(413)
    expect(res.json().error).toBe('file_too_large')
    const me = (await api.get('/api/me')).json()
    expect(await readdir(join(ctx.uploadDir, me.id))).toHaveLength(1)
  })

  it('respeita a cota da conta', async () => {
    expect((await upload({}, { name: 'a.bin', type: 'application/octet-stream', content: Buffer.alloc(9 * KB) })).statusCode).toBe(201)
    const res = await upload({}, { name: 'b.bin', type: 'application/octet-stream', content: Buffer.alloc(9 * KB) })
    expect(res.statusCode).toBe(413)
    expect(res.json().error).toBe('quota_exceeded')
  })

  it('recusa vínculo com plano inexistente e pedido sem arquivo', async () => {
    const bad = await upload({ planId: 'nao-existe' }, { name: 'c.txt', type: 'text/plain', content: 'oi' })
    expect(bad.statusCode).toBe(400)
    expect((await upload({ planId: 'p1' })).statusCode).toBe(400)
  })

  it('renomeia e troca o vínculo', async () => {
    const res = await api.patch(`/api/files/${pdf.id}`, { name: 'Edital final.pdf', subjectId: null })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ name: 'Edital final.pdf', subjectId: null, planId: 'p1' })
    expect((await api.patch(`/api/files/${pdf.id}`, { subjectId: 'outra' })).statusCode).toBe(400)
  })

  it('outra conta não enxerga o arquivo', async () => {
    const other = client(ctx.app, await devLogin(ctx.app, 'outra@coado.test'))
    expect((await other.get(`/api/files/${pdf.id}/content`)).statusCode).toBe(404)
    expect((await other.del(`/api/files/${pdf.id}`)).statusCode).toBe(404)
    expect(((await other.get('/api/files')).json() as FilesResponse).files).toEqual([])
  })

  it('apagar disciplina mantém o arquivo sem vínculo', async () => {
    await api.patch(`/api/files/${pdf.id}`, { subjectId: 's1' })
    await api.post('/api/sync', { deletes: { subjects: ['s1'] } })
    const list: FilesResponse = (await api.get('/api/files')).json()
    expect(list.files.find((f) => f.id === pdf.id)).toMatchObject({ subjectId: null, planId: 'p1' })
  })

  it('apaga arquivo', async () => {
    expect((await api.del(`/api/files/${pdf.id}`)).statusCode).toBe(204)
    expect((await api.get(`/api/files/${pdf.id}/content`)).statusCode).toBe(404)
    expect((await api.get('/api/files/123/content')).statusCode).toBe(404)
  })

  it('excluir a conta apaga dados e arquivos', async () => {
    const me = (await api.get('/api/me')).json()
    expect(await readdir(join(ctx.uploadDir, me.id))).not.toHaveLength(0)
    const res = await api.del('/api/me')
    expect(res.statusCode).toBe(204)
    expect((await api.get('/api/me')).statusCode).toBe(401)
    await expect(readdir(join(ctx.uploadDir, me.id))).rejects.toThrow()
    const { rows } = await ctx.pool.query('select count(*)::int as n from plans where user_id = $1', [me.id])
    expect(rows[0].n).toBe(0)
  })
})
