/**
 * Transport-agnostic error type. Services throw these instead of touching the
 * response; the API layer maps `.status` to the HTTP status code. This keeps
 * services unit-testable (no req/res) and centralises status mapping.
 */
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

export const badRequest = (message: string) => new HttpError(400, message)
export const unauthorized = (message = 'Authentication required.') => new HttpError(401, message)
export const forbidden = (message = 'Not allowed.') => new HttpError(403, message)
export const notFound = (message = 'Not found.') => new HttpError(404, message)
