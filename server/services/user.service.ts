import { canManageUser, roleMeta } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import { sendEmail, inviteEmail, passwordResetLinkEmail } from '../infra/email'
import { signResetToken } from '../infra/auth'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { Role } from '../../shared/types'

// Invite links live longer than the 1h self-service reset link: a freshly invited
// user may not check their email right away. Both stay single-use (the token is
// bound to the current password hash, so following it once invalidates it).
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60

function inferUserType(role: Role): string {
  return roleMeta(role)?.userType ?? 'internal'
}

/** Build the set/reset-password URL the user follows from their email. */
function resetLink(token: string, origin?: string): string {
  const base = (process.env.APP_BASE_URL || origin || 'http://localhost:5173').replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

/** Create a user, gated by canManageUser (company scope + assignable role). */
export async function createUser(store: Store, auth: AuthPayload, user: any, password?: string, origin?: string): Promise<any> {
  if (!user?.email || !user?.fullName) throw badRequest('Name and email are required.')
  const targetCompany = user.companyId ?? auth.companyId
  if (!canManageUser(auth, targetCompany, user.role)) throw forbidden('You cannot create a user with that role/company.')
  let created: any
  try {
    created = await store.createUser(
      {
        id: uid('u'),
        company_id: targetCompany,
        site_id: user.siteId ?? null,
        full_name: user.fullName,
        email: String(user.email).toLowerCase(),
        user_type: user.userType ?? inferUserType(user.role),
        role: user.role,
        status: user.status ?? 'invited',
      },
      password,
    )
  } catch (error: any) {
    throw badRequest(error.message)
  }
  await audit(store, auth, 'user', created.id, 'create', null, { email: created.email, role: created.role })
  // Invite email with a single-use link so the user sets their OWN password and
  // activates the account — no shared/default password ever leaves the server.
  // Best-effort: a failed send must not fail creation (the user can self-serve).
  try {
    const account = await store.getUserAuthById(created.id)
    const token = signResetToken(account.id, account.passwordHash, INVITE_TTL_SECONDS)
    await sendEmail(store, {
      to: created.email,
      ...inviteEmail({ fullName: created.fullName, role: created.role, companyName: account.companyName, link: resetLink(token, origin) }),
    })
  } catch {
    /* invite email is best-effort */
  }
  return created
}

/** Update a user; re-checks canManageUser against the *intended* role. */
export async function updateUser(store: Store, auth: AuthPayload, id: string, body: any): Promise<any> {
  const target = await store.getOne('users', id)
  if (!target) throw notFound('User not found.')
  const { touch, ...fields } = body
  const nextRole = fields.role ?? target.role
  if (!canManageUser(auth, target.companyId, nextRole)) throw forbidden()
  const updated = await store.update('users', id, fields, { touch })
  await audit(store, auth, 'user', id, 'update', { role: target.role, status: target.status }, { role: updated.role, status: updated.status })
  return updated
}

/**
 * Admin-initiated password reset: email the user a single-use link to set a new
 * password themselves. The admin never sees or sets the plaintext — the same
 * secure flow as self-service "forgot password", triggered from the user roster.
 */
export async function resetUserPassword(store: Store, auth: AuthPayload, id: string, origin?: string): Promise<void> {
  const target = await store.getUserAuthById(id)
  if (!target) throw notFound('User not found.')
  if (!canManageUser(auth, target.companyId, target.role)) throw forbidden()
  const token = signResetToken(target.id, target.passwordHash)
  await sendEmail(store, {
    to: target.email,
    ...passwordResetLinkEmail({ fullName: target.fullName, link: resetLink(token, origin) }),
  }).catch(() => {})
  await audit(store, auth, 'user', id, 'reset_password', null, null)
}
