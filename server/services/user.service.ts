import { canManageUser, roleLabel, roleMeta } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import {
  sendEmail,
  inviteEmail,
  passwordResetLinkEmail,
  userMutationAdminEmail,
  accountRemovedEmail,
  inviteSentReceiptEmail,
  notifyInternalAdmins,
} from '../infra/email'
import { signResetToken } from '../infra/auth'
import { recomputeOnboardingStatus } from './onboarding.service'
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
export function resetLink(token: string, origin?: string): string {
  const base = (process.env.APP_BASE_URL || origin || 'http://localhost:5173').replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

/**
 * Email a user the single-use invite link that lets them set their first password
 * and activate their account. Shared by admin-created invites (createUser) and
 * sign-up approvals (signup.service) so the token TTL and link shape stay identical.
 * Best-effort: a failed send must not fail the caller (the user can self-serve a
 * reset). Returns the account row (with companyName) for any follow-on use.
 *
 * `prefetched` lets callers that already loaded the account row (e.g. resendInvite
 * to enforce status/permission gates) skip a redundant DB roundtrip.
 */
export async function sendInviteLink(store: Store, userId: string, origin?: string, prefetched?: any): Promise<any> {
  const account = prefetched ?? (await store.getUserAuthById(userId))
  const token = signResetToken(account.id, account.passwordHash, INVITE_TTL_SECONDS)
  await sendEmail(store, {
    to: account.email,
    ...inviteEmail({ fullName: account.fullName, role: account.role, companyName: account.companyName, link: resetLink(token, origin) }),
  }).catch(() => {})
  return account
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
        // Remember who issued the invite so we can email them when the invitee
        // accepts (client feedback 2026-06).
        invited_by: auth.sub,
      },
      password,
    )
  } catch (error: any) {
    throw badRequest(error.message)
  }
  await audit(store, auth, 'user', created.id, 'create', null, { email: created.email, role: created.role })
  // Notify the new user (invite link), the inviter (dedicated receipt) and the
  // rest of the internal admin pool (skipping the inviter so they don't get the
  // generic fan-out *and* the receipt). All best-effort — a failed send must
  // not fail creation, the user can self-serve a reset.
  try {
    // Single-use set-password link so the user activates their OWN account —
    // no shared/default password ever leaves the server.
    const account = await sendInviteLink(store, created.id, origin)
    await Promise.all([
      sendEmail(store, {
        to: auth.email,
        ...inviteSentReceiptEmail({
          inviterName: auth.name,
          inviteeName: created.fullName,
          inviteeEmail: created.email,
          inviteeRole: roleLabel(created.role as Role),
          companyName: account.companyName,
        }),
      }).catch(() => {}),
      notifyInternalAdmins(
        store,
        userMutationAdminEmail({ action: 'created', fullName: created.fullName, email: created.email, role: created.role, companyName: account.companyName, actor: auth.name }),
        { excludeUserId: auth.sub },
      ),
    ])
  } catch {
    /* notification emails are best-effort */
  }
  // Lifecycle bump: a freshly invited admin moves the company from not_started →
  // invited; a freshly added non-admin in an already-live-ish company → live.
  await recomputeOnboardingStatus(store, targetCompany)
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
 * Re-send the original invite link to a user that hasn't activated yet
 * (status='invited'). Distinct from resetUserPassword so the admin UI can offer
 * the right action by lifecycle stage: "Resend invite" for never-activated
 * accounts, "Reset password" for active ones. Both ultimately email a single-use
 * set-password link — the difference is the wording in the email and that resend
 * refuses to fire on an already-active account (would be misleading copy).
 */
export async function resendInvite(store: Store, auth: AuthPayload, id: string, origin?: string): Promise<void> {
  const target = await store.getUserAuthById(id)
  if (!target) throw notFound('User not found.')
  if (!canManageUser(auth, target.companyId, target.role)) throw forbidden()
  if (target.status !== 'invited') throw badRequest('This user has already activated their account — use Reset password instead.')
  // Reuse the row we just loaded for the gates — sendInviteLink would otherwise
  // re-query the same user+company.
  const account = await sendInviteLink(store, id, origin, target)
  // Best-effort receipt email runs in parallel with the audit insert: audit ordering
  // isn't gated on the email, and SMTP latency shouldn't bottleneck the response.
  await Promise.all([
    sendEmail(store, {
      to: auth.email,
      ...inviteSentReceiptEmail({
        inviterName: auth.name,
        inviteeName: account.fullName,
        inviteeEmail: account.email,
        inviteeRole: roleLabel(account.role as Role),
        companyName: account.companyName,
      }),
    }).catch(() => {}),
    audit(store, auth, 'user', id, 'resend_invite', null, null),
  ])
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

/**
 * Hard-delete a user, gated by canManageUser (same scope as update/create). The
 * account row is removed; related history (calculator runs, requests) is kept but
 * anonymised via ON DELETE SET NULL, and the user's own notifications cascade away.
 * Emails the removed user + internal admins (per client request).
 */
export async function deleteUser(store: Store, auth: AuthPayload, id: string): Promise<{ ok: boolean }> {
  if (id === auth.sub) throw badRequest('You cannot delete your own account.')
  const target = await store.getUserById(id)
  if (!target) throw notFound('User not found.')
  if (!canManageUser(auth, target.companyId, target.role)) throw forbidden('You cannot delete that user.')
  const ok = await store.remove('users', id)
  await audit(store, auth, 'user', id, 'delete', { email: target.email, role: target.role }, null)
  // Notify the removed user, then the internal admins (best-effort, per client request).
  await sendEmail(store, { to: target.email, ...accountRemovedEmail({ fullName: target.fullName, companyName: target.companyName }) }).catch(() => {})
  await notifyInternalAdmins(
    store,
    userMutationAdminEmail({ action: 'deleted', fullName: target.fullName, email: target.email, role: target.role, companyName: target.companyName, actor: auth.name }),
  )
  return { ok }
}
