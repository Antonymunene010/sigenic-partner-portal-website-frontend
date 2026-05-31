import crypto from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import type { CompanyType, Role, UserType } from '../../shared/types'

// Secret + TTL are read lazily (via these helpers), NOT captured at module load.
// index.ts loads .env as a normal statement that runs AFTER this module is
// imported, so reading process.env on each use is what keeps env-load order from
// silently leaving us on the insecure fallback — no import-order dependency.
function secret(): string {
  return process.env.AUTH_SECRET || process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
}
function tokenTtlSeconds(): number {
  return Number(process.env.AUTH_TTL_SECONDS || 60 * 60 * 12) // 12h default
}

// Known weak placeholders that must be replaced before production (openssl rand -hex 32).
const INSECURE_SECRETS = ['dev-insecure-secret-change-me', 'change-me-in-production']

/** Warn if AUTH_SECRET is unset or a known placeholder. Call once at startup, after .env loads. */
export function warnOnInsecureSecret(): void {
  const current = secret()
  if (INSECURE_SECRETS.includes(current)) {
    console.warn(`[auth] AUTH_SECRET is a known placeholder ("${current}") — set a strong random value in production.`)
  }
}

/** The decoded token payload — what every authenticated handler sees as `req.auth`. */
export interface AuthPayload {
  sub: string
  role: Role
  userType: UserType
  companyId: string | null
  companyType: CompanyType | null
  email: string
  name: string
  exp?: number
}

/** Hash a plaintext password with scrypt. Format: scrypt$<salt>$<hash>. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(derived, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Sign a stateless HMAC token. Payload is public (do not put secrets in it). */
export function signToken(payload: Omit<AuthPayload, 'exp'>, ttl = tokenTtlSeconds()): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

/** Verify a token's signature + expiry. Returns the decoded payload or null. */
export function verifyToken(token: string | null | undefined): AuthPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
  let body: AuthPayload
  try {
    body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
  return body
}

/** Extract a Bearer token from a request's Authorization header. */
export function bearerToken(req: { headers: IncomingHttpHeaders }): string | null {
  const header = req.headers['authorization'] || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}
