import { randomInt } from 'node:crypto'
import type { PairCode } from '@coado/shared'
import type { Db } from '../db'
import { pgCode } from '../db'

/** Quanto tempo o código mostrado em Configurações vale */
export const PAIR_CODE_TTL_MS = 10 * 60 * 1000

/** Seis dígitos: dá para digitar no pulso. Vale uma vez e por poucos minutos; a rota é limitada por IP. */
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

/** Gera um código novo para a conta (o anterior, se houver, deixa de valer) */
export async function createPairCode(db: Db, userId: string): Promise<PairCode> {
  await db.query('delete from pair_codes where user_id = $1 or expires_at <= now()', [userId])
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    try {
      const { rows } = await db.query<{ expires_at: Date }>(
        `insert into pair_codes (code, user_id, expires_at) values ($1, $2, now() + make_interval(secs => $3))
         returning expires_at`,
        [code, userId, PAIR_CODE_TTL_MS / 1000],
      )
      return { code, expiresAt: rows[0].expires_at.toISOString() }
    } catch (err) {
      // outro usuário está com o mesmo código ativo: sorteia de novo
      if (pgCode(err) !== '23505') throw err
    }
  }
  throw new Error('não foi possível gerar um código de pareamento')
}

/** Troca o código pelo dono dele e o invalida; null se não existe ou venceu */
export async function consumePairCode(db: Db, code: string): Promise<string | null> {
  const { rows } = await db.query<{ user_id: string }>(
    'delete from pair_codes where code = $1 and expires_at > now() returning user_id',
    [code],
  )
  return rows[0]?.user_id ?? null
}

export async function deleteExpiredPairCodes(db: Db) {
  const { rowCount } = await db.query('delete from pair_codes where expires_at <= now()')
  return rowCount ?? 0
}
