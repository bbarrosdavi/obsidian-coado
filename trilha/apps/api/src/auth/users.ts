import { BUILTIN_CATEGORIES, DEFAULT_REVIEW_INTERVALS, DEFAULT_TIMER_PREFS, type Me } from '@coado/shared'
import type { Db } from '../db'

export interface UserRow {
  id: string
  email: string
  name: string
  avatar_url: string | null
  created_at: Date
  onboarded_at: Date | null
}

export const toMe = (u: UserRow): Me => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatar_url,
  createdAt: u.created_at.toISOString(),
  onboardedAt: u.onboarded_at?.toISOString() ?? null,
})

/** Preferências e categorias padrão de uma conta nova */
export async function createUserDefaults(db: Db, userId: string) {
  await db.query(
    `insert into user_settings (user_id, timer_prefs, review_intervals) values ($1, $2, $3)
     on conflict (user_id) do nothing`,
    [userId, JSON.stringify(DEFAULT_TIMER_PREFS), DEFAULT_REVIEW_INTERVALS],
  )
  await db.query(
    `insert into categories (user_id, id, name, builtin)
     select $1, x.id, x.name, true from jsonb_to_recordset($2::jsonb) as x(id text, name text)
     on conflict (user_id, id) do nothing`,
    [userId, JSON.stringify(BUILTIN_CATEGORIES)],
  )
}

/**
 * Cria a conta no primeiro login ou atualiza e-mail/foto nos seguintes.
 * O nome só é definido na criação: depois ele pode ser editado no perfil.
 */
export async function ensureUser(
  db: Db,
  identity: { googleSub: string; email: string; name: string; avatarUrl: string | null },
): Promise<UserRow> {
  const { rows } = await db.query<UserRow & { inserted: boolean }>(
    `insert into users (google_sub, email, name, avatar_url, last_login_at)
     values ($1, $2, $3, $4, now())
     on conflict (google_sub) do update
       set email = excluded.email, avatar_url = excluded.avatar_url, last_login_at = now(), updated_at = now()
     returning id, email, name, avatar_url, created_at, onboarded_at, (xmax = 0) as inserted`,
    [identity.googleSub, identity.email, identity.name.slice(0, 120), identity.avatarUrl],
  )
  const user = rows[0]
  if (user.inserted) await createUserDefaults(db, user.id)
  return user
}

export async function findUser(db: Db, id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(
    'select id, email, name, avatar_url, created_at, onboarded_at from users where id = $1',
    [id],
  )
  return rows[0] ?? null
}
