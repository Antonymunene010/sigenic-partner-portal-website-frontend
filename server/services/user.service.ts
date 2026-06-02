import { canManageUser, roleMeta } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import { sendEmail, inviteEmail, passwordResetEmail } from '../infra/email'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { Role } from '../../shared/types'

function inferUserType(role: Role): string {
  return roleMeta(role)?.userType ?? 'internal'
}

/** Create a user, gated by canManageUser (company scope + assignable role). */
export async function createUser(store: Store, auth: AuthPayload, user: any, password?: string): Promise<any> {
  if (!user?.email || !user?.fullName) throw badRequest('Name and email are required.')
  const targetCompany = user.companyId ?? auth.companyId
  if (!canManageUser(auth, targetCompany, user.role)) throw forbidden('You cannot create a user with that role/company.')
  try {
    const created = await store.createUser(
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
    await audit(store, auth, 'user', created.id, 'create', null, { email: created.email, role: created.role })
    // Invite email so the new user actually learns their account exists (PRD §7.7).
    await sendEmail(store, { to: created.email, ...inviteEmail({ fullName: created.fullName, role: created.role }) }).catch(() => {})
    return created
  } catch (error: any) {
    throw badRequest(error.message)
  }
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

export async function resetUserPassword(store: Store, auth: AuthPayload, id: string, password: string): Promise<void> {
  const target = await store.getOne('users', id)
  if (!target) throw notFound('User not found.')
  if (!canManageUser(auth, target.companyId, target.role)) throw forbidden()
  if (!password || String(password).length < 4) throw badRequest('Password must be at least 4 characters.')
  await store.setPassword(id, password)
  await audit(store, auth, 'user', id, 'reset_password', null, null)
  await sendEmail(store, { to: target.email, ...passwordResetEmail({ fullName: target.fullName }) }).catch(() => {})
}
