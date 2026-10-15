import { diffState, type AppState } from '@coado/shared'
import { api, ApiError } from './api'

/*
 * Motor de sincronização: o estado vive em memória (ações instantâneas) e as diferenças em
 * relação ao último estado confirmado pelo servidor são enviadas em lote para POST /api/sync.
 * Falhas de rede são repetidas com backoff; o lote seguinte sempre inclui o que ficou para trás.
 */

export type SyncStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error'

const DEBOUNCE_MS = 700
const MAX_WAIT_MS = 4000
const MAX_RETRY_MS = 30_000

export class SyncEngine {
  /** último estado que o servidor confirmou */
  private base: AppState
  private current: AppState
  private status: SyncStatus = 'saved'
  private timer: ReturnType<typeof setTimeout> | null = null
  private firstPendingAt = 0
  private retryMs = 0
  private inFlight: Promise<void> | null = null
  private listeners = new Set<() => void>()
  private readonly onUnauthorized: () => void

  errorMessage = ''

  constructor(initial: AppState, onUnauthorized: () => void) {
    this.base = initial
    this.current = initial
    this.onUnauthorized = onUnauthorized
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getStatus = () => this.status

  /** há algo que ainda não chegou ao servidor */
  get dirty() {
    return this.current !== this.base || this.inFlight !== null
  }

  private setStatus(s: SyncStatus) {
    if (s === this.status) return
    this.status = s
    this.listeners.forEach((fn) => fn())
  }

  /** Chamado a cada mudança de estado */
  push(next: AppState) {
    if (next === this.current) return
    this.current = next
    if (this.status === 'saved') this.setStatus('pending')
    if (!this.firstPendingAt) this.firstPendingAt = Date.now()
    if (this.retryMs) return // já há uma nova tentativa agendada
    this.schedule(Math.min(DEBOUNCE_MS, Math.max(0, this.firstPendingAt + MAX_WAIT_MS - Date.now())))
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, ms)
  }

  /** Envia o que estiver pendente agora */
  flush(opts: { keepalive?: boolean } = {}): Promise<void> {
    if (this.inFlight) return this.inFlight
    const req = diffState(this.base, this.current)
    if (!req) {
      this.base = this.current
      this.firstPendingAt = 0
      this.setStatus('saved')
      return Promise.resolve()
    }
    const sending = this.current
    this.setStatus('saving')
    this.inFlight = api
      .post('/sync', req, { keepalive: opts.keepalive })
      .then(() => {
        this.base = sending
        this.retryMs = 0
        this.errorMessage = ''
        if (this.current === sending) {
          this.firstPendingAt = 0
          this.setStatus('saved')
        } else {
          this.firstPendingAt = Date.now()
          this.setStatus('pending')
          this.schedule(DEBOUNCE_MS)
        }
      })
      .catch((e: unknown) => this.fail(e))
      .finally(() => {
        this.inFlight = null
      })
    return this.inFlight
  }

  private fail(e: unknown) {
    const err = e instanceof ApiError ? e : new ApiError(0, 'offline', String(e))
    if (err.status === 401) {
      this.setStatus('error')
      this.onUnauthorized()
      return
    }
    // dados recusados (400/409/413): repetir não resolve
    if (err.status >= 400 && err.status < 500) {
      this.errorMessage = err.message
      this.setStatus('error')
      return
    }
    this.errorMessage = err.message
    this.setStatus('offline')
    this.retryMs = Math.min(MAX_RETRY_MS, this.retryMs ? this.retryMs * 2 : 2000)
    this.schedule(this.retryMs)
  }

  /** Tenta de novo imediatamente (ex.: voltou a conexão) */
  retry() {
    if (this.status !== 'offline' && this.status !== 'error') return
    this.retryMs = 0
    void this.flush()
  }

  /** Aguarda envios em andamento e cancela o agendado (antes de substituir tudo) */
  async settle() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.inFlight) await this.inFlight
  }

  /** Estado vindo do servidor passa a ser a nova base (importação, recarga) */
  rebase(state: AppState) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.base = state
    this.current = state
    this.retryMs = 0
    this.firstPendingAt = 0
    this.errorMessage = ''
    this.setStatus('saved')
  }

  /** O usuário está sem nada pendente e o estado local é exatamente a base */
  get idle() {
    return !this.inFlight && !this.timer && this.current === this.base
  }

  get snapshot() {
    return this.current
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer)
    this.listeners.clear()
  }
}
