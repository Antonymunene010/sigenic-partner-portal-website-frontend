import express from 'express'
import { cors } from './api/middleware/cors'
import { authenticate } from './api/middleware/authenticate'
import { errorHandler } from './api/middleware/error'
import { notFoundJson } from './api/middleware/notFound'
import { makeServeStatic } from './api/static'
import { publicRouter } from './api/publicRouter'
import { apiRouter } from './api/apiRouter'
import type { Store } from './db/store'

/**
 * Assemble the Express app. Middleware order matters:
 *   cors → JSON body (5mb) → public routes → authenticate + private routes →
 *   JSON 404 for /api → SPA static fallback → central error handler.
 */
export function buildApp(store: Store, root: string) {
  const app = express()
  app.use(cors)
  app.use('/api', express.json({ limit: '5mb' }))
  app.use('/api', publicRouter(store))
  app.use('/api', authenticate, apiRouter(store))
  app.use('/api', notFoundJson)
  app.use(makeServeStatic(root))
  app.use(errorHandler)
  return app
}
