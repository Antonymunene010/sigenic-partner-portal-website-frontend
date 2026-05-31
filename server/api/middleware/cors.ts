import type { Request, Response, NextFunction } from 'express'

/** Permissive CORS + no-store, mirroring the original response headers. Short-circuits OPTIONS. */
export function cors(req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Cache-Control': 'no-store',
  })
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
}
