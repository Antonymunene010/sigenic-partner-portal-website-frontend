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

/**
 * A high-entropy, unguessable secret. Used as the placeholder password for an
 * invited user who hasn't set one yet: they can't log in with it (nobody knows
 * it), and it gives the invite link a real hash to fingerprint against.
 */
export function randomPassword(): string {
  return crypto.randomBytes(24).toString('hex')
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

// Token wire format, shared by login and password-reset tokens: `<base64url(json)>.<base64url(hmac)>`.
// Login and reset tokens differ only in their signing key (disjoint signature spaces) and payload
// shape — the encode/verify mechanics live here once so the two can't drift.
function encodeSigned(body: object, key: string): string {
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', key).update(data).digest('base64url')
  return `${data}.${sig}`
}

/** Verify an `encodeSigned` token's signature and return its decoded body, or null. Does NOT check expiry. */
function decodeSigned(token: string | null | undefined, key: string): any | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  if (!data || !sig) return null
  const expected = crypto.createHmac('sha256', key).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/** Sign a stateless HMAC token. Payload is public (do not put secrets in it). */
export function signToken(payload: Omit<AuthPayload, 'exp'>, ttl = tokenTtlSeconds()): string {
  return encodeSigned({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl }, secret())
}

/** Verify a token's signature + expiry. Returns the decoded payload or null. */
export function verifyToken(token: string | null | undefined): AuthPayload | null {
  const body = decodeSigned(token, secret()) as AuthPayload | null
  if (!body || !body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
  return body
}

/** Extract a Bearer token from a request's Authorization header. */
export function bearerToken(req: { headers: IncomingHttpHeaders }): string | null {
  const header = req.headers['authorization'] || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

/* ----- password reset (stateless, single-use) ----- */

// Reset tokens are signed with a key namespaced off the auth secret, so a reset
// token can never be replayed as a login token (verifyToken) or vice-versa —
// their signatures live in disjoint spaces.
function resetSecret(): string {
  return `${secret()}:pwreset-v1`
}
function resetTtlSeconds(): number {
  return Number(process.env.RESET_TTL_SECONDS || 60 * 60) // 1h default
}

/**
 * A short fingerprint of the user's current password hash. Embedding it in the
 * reset token makes the link single-use: completing a reset changes the hash, so
 * the fingerprint no longer matches and the link (plus any copies) stops working.
 */
function passwordFingerprint(passwordHash: string): string {
  return crypto.createHmac('sha256', resetSecret()).update(String(passwordHash)).digest('hex').slice(0, 16)
}

export interface ResetPayload {
  sub: string
  fp: string
  exp: number
}

/** Sign a time-boxed, single-use password-reset token bound to the user's current password. */
export function signResetToken(userId: string, passwordHash: string, ttl = resetTtlSeconds()): string {
  return encodeSigned({ k: 'pwreset', sub: userId, fp: passwordFingerprint(passwordHash), exp: Math.floor(Date.now() / 1000) + ttl }, resetSecret())
}

/** Verify a reset token's signature, purpose and expiry. Returns the payload or null.
 *  The caller MUST still confirm `fp` matches the user's *current* password hash. */
export function verifyResetToken(token: string | null | undefined): ResetPayload | null {
  const body = decodeSigned(token, resetSecret())
  if (!body || body.k !== 'pwreset' || typeof body.sub !== 'string' || typeof body.fp !== 'string') return null
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
  return { sub: body.sub, fp: body.fp, exp: body.exp }
}

/** Constant-time check that a reset token's fingerprint still matches the stored hash (i.e. unused). */
export function passwordFingerprintMatches(passwordHash: string, fp: string): boolean {
  const a = Buffer.from(passwordFingerprint(passwordHash))
  const b = Buffer.from(String(fp))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
