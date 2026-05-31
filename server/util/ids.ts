import crypto from 'node:crypto'

/** Generate a prefixed, collision-resistant id, e.g. uid('sr') → 'sr-3f9a...'. */
export const uid = (prefix: string): string => `${prefix}-${crypto.randomBytes(6).toString('hex')}`

export const nowIso = (): string => new Date().toISOString()
