/**
 * Typed errors used by the Chaite web API.
 *
 * The HTTP layer maps these to stable error codes so the frontend can react
 * without parsing human-readable messages. Keep this module dependency-free:
 * session, fusion and evolution services all throw from here.
 */

export interface WebApiErrorOptions {
  /** HTTP status code. Defaults to 500. */
  status?: number
  /** Stable machine-readable code, e.g. `SESSION_BUSY`. */
  code?: string
  /** Extra JSON-serialisable context for the client. */
  details?: unknown
  /** Underlying error, preserved for logging. */
  cause?: unknown
}

export class WebApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, options: WebApiErrorOptions = {}) {
    super(message)
    this.name = 'WebApiError'
    this.status = options.status ?? 500
    this.code = options.code ?? 'INTERNAL_ERROR'
    this.details = options.details
    if (options.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export class BadRequestError extends WebApiError {
  constructor(message: string, options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 400, code: options.code ?? 'BAD_REQUEST' })
    this.name = 'BadRequestError'
  }
}

export class UnauthorizedError extends WebApiError {
  constructor(message = 'Unauthorized', options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 401, code: 'UNAUTHORIZED' })
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends WebApiError {
  constructor(message = 'Forbidden', options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 403, code: 'FORBIDDEN' })
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends WebApiError {
  constructor(message = 'Not found', options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 404, code: options.code ?? 'NOT_FOUND' })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends WebApiError {
  constructor(message: string, options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 409, code: options.code ?? 'CONFLICT' })
    this.name = 'ConflictError'
  }
}

export class ServiceUnavailableError extends WebApiError {
  constructor(message: string, options: Omit<WebApiErrorOptions, 'status'> = {}) {
    super(message, { ...options, status: 503, code: options.code ?? 'SERVICE_UNAVAILABLE' })
    this.name = 'ServiceUnavailableError'
  }
}

/** Normalise any thrown value into a {@link WebApiError}. */
export function toWebApiError(error: unknown): WebApiError {
  if (error instanceof WebApiError) return error
  if (error instanceof Error) {
    return new WebApiError(error.message, { status: 500, code: 'INTERNAL_ERROR', cause: error })
  }
  return new WebApiError(String(error), { status: 500, code: 'INTERNAL_ERROR', cause: error })
}
