import type { AuthPayload } from '../infra/auth'

// Augment Express's Request with the decoded token set by the authenticate middleware.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}
