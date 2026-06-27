import { verifyPassword, signToken, signResetToken, verifyResetToken, passwordFingerprintMatches } from '../infra/auth'
import {
  sendEmail,
  passwordResetLinkEmail,
  passwordChangedEmail,
  inviteAcceptedEmail,
  notifyInternalAdmins,
} from '../infra/email'
import { badRequest, forbidden, notFound, unauthorized } from '../http/errors'
import { recomputeOnboardingStatus } from './onboarding.service'
import { roleLabel } from '../../shared/permissions'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { Role } from '../../shared/types'

const MIN_PASSWORD_LENGTH = 4

export async function login(store: Store, email: string, password: string): Promise<{ user: any; token: string }> {
  if (!email || !password) throw badRequest('Email and password are required.')
  const account = await store.getUserAuthByEmail(String(email))
  if (!account) throw notFound('No account found for that email.')
  if (account.status === 'inactive') throw forbidden('This account is deactivated.')
  if (!verifyPassword(password, account.passwordHash)) throw unauthorized('Incorrect password.')
  await store.setLastLogin(account.id)
  const token = signToken({
    sub: account.id,
    role: account.role,
    userType: account.userType,
    companyId: account.companyId,
    companyType: account.companyType,
    email: account.email,
    name: account.fullName,
  })
  const user = await store.getUserById(account.id)
  return { user, token }
}

export async function changePassword(store: Store, auth: AuthPayload, currentPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) throw badRequest(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  const account = await store.getUserAuthByEmail(auth.email)
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) throw badRequest('Current password is incorrect.')
  await store.setPassword(account.id, newPassword)
}

export async function getMe(store: Store, auth: AuthPayload): Promise<any> {
  return store.getUserById(auth.sub)
}

/**
 * Begin a self-service password reset. Resolves identically whether or not the
 * email maps to an account, so the endpoint can't be used to enumerate users:
 * only an active account actually receives a time-boxed, single-use reset link.
 */
export async function requestPasswordReset(store: Store, email: string, origin?: string): Promise<void> {
  if (!email) throw badRequest('Email is required.')
  const account = await store.getUserAuthByEmail(String(email))
  if (!account || account.status === 'inactive') return // silent no-op — never reveal whether the email exists
  const token = signResetToken(account.id, account.passwordHash)
  const base = (process.env.APP_BASE_URL || origin || 'http://localhost:5173').replace(/\/$/, '')
  const link = `${base}/reset-password?token=${encodeURIComponent(token)}`
  const msg = await passwordResetLinkEmail(store, { fullName: account.fullName, link })
  await sendEmail(store, { to: account.email, ...msg }).catch(() => {})
}

/** Complete a self-service reset using the token from the email link. */
export async function resetPasswordWithToken(store: Store, token: string, newPassword: string): Promise<void> {
  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  const payload = verifyResetToken(token)
  if (!payload) throw badRequest('This reset link is invalid or has expired. Please request a new one.')
  const account = await store.getUserAuthById(payload.sub)
  if (!account || account.status === 'inactive') throw badRequest('This reset link is no longer valid.')
  if (!passwordFingerprintMatches(account.passwordHash, payload.fp)) {
    throw badRequest('This reset link has already been used. Please request a new one.')
  }
  await store.setPassword(account.id, newPassword)
  // Kick off the "password changed" render up front so the invite-accepted
  // fan-out (further down) overlaps with the email_templates round-trip rather
  // than serializing after it. Awaited at the end so the original ordering of
  // user-visible side effects is preserved.
  const changedMsgPromise = passwordChangedEmail(store, { fullName: account.fullName })
  // An invited user activates their account by setting their first password.
  const wasInvited = account.status === 'invited'
  if (wasInvited) {
    await store.update('users', account.id, { status: 'active' }, { touch: false })
    // …and the first accepted invite flips their company live, too (client feedback
    // 2026-06: company goes Pending Invite → Active once its admin accepts). Guarded
    // on the company still being pending_invite so a later invitee is a no-op.
    if (account.companyId) {
      const company = await store.getOne('companies', account.companyId)
      if (company?.status === 'pending_invite') {
        await store.update('companies', account.companyId, { status: 'active' }, { touch: false })
      }
    }
    // Notify the inviter (and any other internal admins) that the invitee has
    // accepted (client feedback 2026-06: previously there was no signal at all
    // that someone had activated their account). Best-effort; exclude the
    // inviter from the admin fan-out so they don't get the message twice when
    // they happen to be an internal admin themselves.
    const accepted = await inviteAcceptedEmail(store, {
      inviteeName: account.fullName,
      inviteeEmail: account.email,
      inviteeRole: roleLabel(account.role as Role),
      companyName: account.companyName,
    })
    const inviter = account.invitedBy ? await store.getUserById(account.invitedBy).catch(() => null) : null
    await Promise.all([
      inviter?.email ? sendEmail(store, { to: inviter.email, ...accepted }).catch(() => {}) : Promise.resolve(),
      notifyInternalAdmins(store, accepted, { excludeUserId: inviter?.id ?? null }).catch(() => {}),
    ])
    await recomputeOnboardingStatus(store, account.companyId)
  }
  const msg = await changedMsgPromise
  await sendEmail(store, { to: account.email, ...msg }).catch(() => {})
}
