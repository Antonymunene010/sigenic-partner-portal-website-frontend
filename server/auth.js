import crypto from 'node:crypto'

const SECRET =
  process.env.AUTH_SECRET || process.env.JWT_SECRET || 'dev-insecure-secret-change-me'
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TTL_SECONDS || 60 * 60 * 12) // 12h default

if (SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[auth] AUTH_SECRET is unset — using an insecure development secret. Set AUTH_SECRET in production.')
}

/** Hash a plaintext password with scrypt. Format: scrypt$<salt>$<hash>. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(derived, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Sign a stateless HMAC token. Payload is public (do not put secrets in it). */
export function signToken(payload, ttl = TOKEN_TTL_SECONDS) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

/** Verify a token's signature + expiry. Returns the decoded payload or null. */
export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
  let body
  try {
    body = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null
  return body
}

/** Extract a Bearer token from a request's Authorization header. */
export function bearerToken(req) {
  const header = req.headers['authorization'] || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}
