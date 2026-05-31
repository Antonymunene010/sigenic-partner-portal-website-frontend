import type { Request, Response, NextFunction } from 'express'
import { bearerToken, verifyToken } from '../../infra/auth'

/** Resolve the Bearer token to req.auth, or 401. Mount after the public routes. */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req)
  const auth = token ? verifyToken(token) : null
  if (!auth) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  req.auth = auth
  next()
}
