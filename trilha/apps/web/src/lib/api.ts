import { CSRF_HEADER, type ApiErrorBody } from '@coado/shared'

/** Erro HTTP da api (status 0 = sem conexão) */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }

  get offline() {
    return this.status === 0
  }
}

type Options = { body?: unknown; signal?: AbortSignal; keepalive?: boolean }

async function request<T>(method: string, path: string, { body, signal, keepalive }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') headers[CSRF_HEADER] = '1'
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
      keepalive,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'offline', 'Sem conexão com o servidor.')
  }

  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null
  if (!res.ok) {
    const err = data as ApiErrorBody | null
    throw new ApiError(res.status, err?.error ?? 'http', err?.message ?? `Erro ${res.status}`)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, opts?: Options) => request<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: Options) => request<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Options) => request<T>('PUT', path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Options) => request<T>('PATCH', path, { ...opts, body }),
  delete: <T = void>(path: string, opts?: Options) => request<T>('DELETE', path, opts),
}

/** Upload com progresso (fetch ainda não expõe progresso de envio) */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (ratio: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    xhr.setRequestHeader(CSRF_HEADER, '1')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      const data = xhr.response as T | ApiErrorBody | null
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T)
      else {
        const err = data as ApiErrorBody | null
        reject(new ApiError(xhr.status, err?.error ?? 'http', err?.message ?? `Erro ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'offline', 'Sem conexão com o servidor.'))
    xhr.send(form)
  })
}
