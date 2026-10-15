import type { ApiErrorBody } from '@coado/shared'

/** Erro com status HTTP e código estável que o front pode tratar */
export class HttpError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: unknown

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  toBody(): ApiErrorBody {
    return { error: this.code, message: this.message, ...(this.details !== undefined && { details: this.details }) }
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'validation', message, details)
export const unauthorized = () => new HttpError(401, 'unauthorized', 'Entre com sua conta para continuar.')
export const notFound = (what = 'Recurso') => new HttpError(404, 'not_found', `${what} não encontrado.`)
