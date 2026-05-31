import type { Request, Response, NextFunction } from 'express'
import { HttpError } from '../../http/errors'

/**
 * Central error handler. Maps HttpError.status (defaults to 500); body-parser
 * errors carry their own .status (e.g. 413/400). If headers are already sent,
 * delegate to Express's finalizer rather than double-writing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(`[api] ${req.method} ${req.path} failed: ${err?.stack || err?.message}`)
  if (res.headersSent) {
    next(err)
    return
  }
  const status = err instanceof HttpError ? err.status : typeof err?.status === 'number' ? err.status : 500
  res.status(status).json({ error: err?.message ?? 'Internal error' })
}
