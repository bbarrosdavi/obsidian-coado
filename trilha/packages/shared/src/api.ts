import type { AssessmentKind, CycleItem, DateStr, ID, PlanKind, Planning, TimerPrefs } from './types'

/*
 * Contrato HTTP entre web e api (prefixo /api).
 *
 * Toda requisição que altera algo (POST/PUT/PATCH/DELETE) precisa do cabeçalho
 * `X-Coado-Request: 1` — defesa contra CSRF somada ao cookie SameSite=Lax.
 *
 * A sessão vai no cookie (navegador) ou em `Authorization: Bearer <token>` (relógio pareado).
 *
 *  GET    /health                       → { status, db }
 *  GET    /auth/config                  → AuthConfig
 *  GET    /auth/google?returnTo=/rota   → 302 para o Google
 *  GET    /auth/google/callback         → 302 para returnTo (ou /?authError=codigo)
 *  POST   /auth/dev  { name?, email? }  → 204 (só com AUTH_DEV_LOGIN=true fora de produção)
 *  POST   /auth/logout                  → 204 (cookie ou Bearer)
 *
 *  Apps (apps/android), sessões de aparelho com token Bearer:
 *  POST   /auth/google/token { idToken, device } → PairResponse (201; Sign in with Google nativo)
 *  POST   /auth/dev/token { name?, email?, device } → PairResponse (201; só com AUTH_DEV_LOGIN)
 *  GET    /auth/web-session?returnTo=/  → 302 com o cookie de sessão (Bearer → sessão web; a WebView do app)
 *  GET    /me                           → Me
 *  PATCH  /me        ProfilePatch       → Me
 *  DELETE /me                           → 204 (apaga conta, dados e arquivos)
 *  GET    /me/sessions                  → SessionInfo[]
 *  DELETE /me/sessions                  → 204 (encerra as outras sessões)
 *  DELETE /me/sessions/:id              → 204
 *  GET    /state                        → AppState
 *  PUT    /state     AppState           → AppState (substitui tudo; importação de backup)
 *  POST   /sync      SyncRequest        → SyncResponse
 *  GET    /files                        → FilesResponse
 *  POST   /files     multipart: file, planId?, subjectId? → FileMeta (201)
 *  PATCH  /files/:id FilePatch          → FileMeta
 *  GET    /files/:id/content[?download=1] → conteúdo do arquivo
 *  DELETE /files/:id                    → 204
 *
 *  Relógio e celular (apps/android):
 *  POST   /watch/pair-code              → PairCode (só pelo navegador; vale 10 min, uma vez)
 *  POST   /watch/pair { code, device }  → PairResponse (201; sem sessão: cria a sessão do aparelho)
 *  GET    /watch/snapshot?today=YYYY-MM-DD → WatchSnapshot (recorte da conta para o pulso)
 */

export const CSRF_HEADER = 'x-coado-request'

export interface AuthConfig {
  google: boolean
  devLogin: boolean
  /** client id OAuth (público) que o app Android usa para pedir o id_token */
  googleClientId?: string | null
}

export interface Me {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
  onboardedAt: string | null
}

export interface SessionInfo {
  id: string
  createdAt: string
  lastSeenAt: string
  userAgent: string | null
  current: boolean
}

export interface FileMeta {
  id: string
  name: string
  mime: string
  size: number
  planId: string | null
  subjectId: string | null
  createdAt: string
}

export interface StorageUsage {
  /** bytes */
  used: number
  quota: number
  maxFileSize: number
}

export interface FilesResponse {
  files: FileMeta[]
  usage: StorageUsage
}

export interface SyncResponse {
  ok: true
  syncedAt: string
}

export interface ApiErrorBody {
  error: string
  message: string
  details?: unknown
}

/** Códigos de erro de login devolvidos em /?authError= */
export type AuthErrorCode = 'state' | 'denied' | 'exchange' | 'email' | 'config'

// ---------- relógio ----------

/** Código curto mostrado em Configurações → Relógio */
export interface PairCode {
  code: string
  expiresAt: string
}

export interface PairResponse {
  /** token de aparelho: vai em `Authorization: Bearer` e nunca é mostrado de novo */
  token: string
  me: Pick<Me, 'name' | 'email'>
  expiresAt: string
}

/** Estudo no recorte do relógio (sem material, páginas, vídeos e comentário) */
export interface WatchStudy {
  id: ID
  subjectId: ID
  topicId?: ID
  categoryId: ID
  date: DateStr
  time?: string
  /** segundos */
  duration: number
  hits: number
  misses: number
  countInPlanning: boolean
  assessmentId?: ID
}

/** Avaliação pendente no recorte do relógio (modo universidade) */
export interface WatchAssessment {
  id: ID
  subjectId: ID
  name: string
  kind: AssessmentKind
  date: DateStr
  time?: string
}

/**
 * O que o relógio precisa para montar a próxima sessão do ciclo e contabilizar o dia.
 * Os estudos vêm desde o início do ciclo atual (ou da semana, o que for mais antigo);
 * os dias estudados vêm inteiros, para a constância.
 */
export interface WatchSnapshot {
  serverTime: string
  /** a data que o relógio informou (ou a do servidor) */
  today: DateStr
  plan: { id: ID; name: string; examDate?: DateStr; kind?: PlanKind; weeklyGoal: { minutes: number; questions: number } } | null
  subjects: { id: ID; name: string; color: string }[]
  categories: { id: ID; name: string }[]
  timerPrefs: TimerPrefs
  reviewIntervals: number[]
  planning: Pick<Planning, 'type' | 'cycleStartedAt' | 'completedCycles'> & { cycle: CycleItem[] } | null
  studies: WatchStudy[]
  studiedDates: DateStr[]
  /** revisões pendentes até hoje */
  reviewsDue: number
  /** avaliações ainda não feitas, da mais próxima (atrasadas primeiro) para a mais distante */
  assessments: WatchAssessment[]
}
