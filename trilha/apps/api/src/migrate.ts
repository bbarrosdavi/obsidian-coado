import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool, type Pool } from './db'

/** src/migrate.ts (tsx) e dist/migrate.js (bundle) ficam ambos um nível abaixo de migrations/ */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations', import.meta.url))

const LOCK_KEY = 72_610_001

/** Aplica, em ordem, os arquivos .sql ainda não registrados em schema_migrations */
export async function migrate(pool: Pool, dir = MIGRATIONS_DIR, log: (msg: string) => void = () => {}) {
  const client = await pool.connect()
  try {
    // impede duas instâncias migrando ao mesmo tempo
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY])
    await client.query(`create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`)
    const { rows } = await client.query<{ name: string }>('select name from schema_migrations')
    const applied = new Set(rows.map((r) => r.name))
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
    const done: string[] = []
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await readFile(join(dir, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (name) values ($1)', [file])
        await client.query('commit')
      } catch (err) {
        await client.query('rollback')
        throw new Error(`Falha na migração ${file}: ${(err as Error).message}`, { cause: err })
      }
      log(`migração aplicada: ${file}`)
      done.push(file)
    }
    return done
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {})
    client.release()
  }
}

const samePath = (a: string, b: string) =>
  process.platform === 'win32' ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b)
const isMain = !!process.argv[1] && samePath(fileURLToPath(import.meta.url), process.argv[1])

if (isMain) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL é obrigatória')
    process.exit(1)
  }
  const pool = createPool(url)
  migrate(pool, MIGRATIONS_DIR, (m) => console.log(m))
    .then((done) => console.log(done.length ? `${done.length} migração(ões) aplicada(s)` : 'banco já está atualizado'))
    .catch((err) => {
      console.error(err)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
