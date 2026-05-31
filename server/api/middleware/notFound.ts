import type { Request, Response } from 'express'

/** Terminal JSON 404 for unmatched /api/* routes (kept distinct from the SPA fallback). */
export function notFoundJson(_req: Request, res: Response): void {
  res.status(404).json({ error: 'API route not found.' })
}
