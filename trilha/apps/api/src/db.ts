import pg from 'pg'

// DATE vem como 'YYYY-MM-DD' puro: converter para Date aplicaria fuso e mudaria o dia
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)
// BIGINT (tamanho de arquivo, somas) cabe com folga em number
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v))

export type Pool = pg.Pool
export type Db = pg.Pool | pg.PoolClient

export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 10 })
}

/** Executa `fn` numa transação; desfaz tudo se lançar */
export async function tx<T>(pool: Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Erro do Postgres com código SQLSTATE */
export const pgCode = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : undefined
