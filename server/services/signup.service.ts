import { canApproveSignup, plainUserRoleForType, primaryAdminRoleForType, roleMeta } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import { sendInviteLink } from './user.service'
import { recomputeOnboardingStatus } from './onboarding.service'
import {
  sendEmail,
  signupReceiptEmail,
  signupPendingAdminEmail,
  signupRejectedEmail,
  notifyInternalAdmins,
  notifyCompanyAdmins,
} from '../infra/email'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { CompanyType, Role } from '../../shared/types'

/** Company types an external user may sign up against (never the Sigenic internal org). */
const JOINABLE_TYPES: CompanyType[] = ['distributor', 'customer']

/** What a new company a registrant requests looks like. */
interface NewCompanyInput {
  companyName: string
  companyType: CompanyType
  country?: string
  website?: string
}

interface SignupInput {
  fullName?: string
  email?: string
  /** Join an existing company by id … */
  companyId?: string
  /** … or request a brand-new company (mutually exclusive with companyId). */
  newCompany?: NewCompanyInput
}

/**
 * Resolved sign-up target: the company to place the user in (existing or
 * to-be-created) plus the role they'll be granted on approval. Computed before
 * any write so a bad request creates nothing.
 */
interface SignupPlan {
  companyId: string | null
  companyName: string
  grantedRole: Role
  newCompany: NewCompanyInput | null
}

async function planSignup(store: Store, input: SignupInput): Promise<SignupPlan> {
  const wantsNewCompany = !!input.newCompany
  if (!wantsNewCompany && !input.companyId) {
    throw badRequest('Select your company, or choose "My company is not listed" to request a new one.')
  }
  if (wantsNewCompany && input.companyId) {
    throw badRequest('Choose either an existing company or a new company, not both.')
  }
  if (wantsNewCompany) {
    const nc = input.newCompany as NewCompanyInput
    const name = String(nc.companyName ?? '').trim()
    if (!name) throw badRequest('Company name is required for a new company.')
    if (!JOINABLE_TYPES.includes(nc.companyType)) throw badRequest('Choose a valid company type.')
    // First member of a new company is its primary admin.
    return { companyId: null, companyName: name, grantedRole: primaryAdminRoleForType(nc.companyType), newCompany: { ...nc, companyName: name } }
  }
  const company = await store.getOne('companies', String(input.companyId))
  // Don't reveal whether the id existed — same generic failure as a bad type.
  if (!company || !JOINABLE_TYPES.includes(company.companyType) || !['active', 'pending_invite'].includes(company.status)) {
    throw badRequest('That company is not available to join. Choose another, or request a new company.')
  }
  return { companyId: company.id, companyName: company.companyName, grantedRole: plainUserRoleForType(company.companyType), newCompany: null }
}

/**
 * Public, unauthenticated self-service sign-up (client feedback 2026-06). Creates a
 * `pending` user (and, for a new-company request, a `pending_invite` company) and
 * alerts whoever approves it. No password is set and no set-password link is sent
 * until an admin approves — that step reuses the normal invite flow.
 */
export async function signup(store: Store, input: SignupInput, origin?: string): Promise<{ ok: true }> {
  const fullName = String(input?.fullName ?? '').trim()
  const email = String(input?.email ?? '').trim().toLowerCase()
  if (!fullName || !email) throw badRequest('Name and email are required.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('Enter a valid email address.')

  const plan = await planSignup(store, input)
  const isNewCompany = !!plan.newCompany
  const base = (process.env.APP_BASE_URL || origin || 'http://localhost:5173').replace(/\/$/, '')
  const reviewLink = `${base}/app/admin/signups`

  // New-company request: provision the pending_invite company first so the pending
  // user has a home. Sigenic admins approve it (canApproveSignup denies any external
  // admin a company that isn't theirs, and the registrant is its only member).
  let companyId = plan.companyId
  if (plan.newCompany) {
    const nc = plan.newCompany
    const created = await store.insert('companies', {
      id: uid('co'),
      company_name: nc.companyName,
      company_type: nc.companyType,
      country: nc.country?.trim() || null,
      website: nc.website?.trim() || null,
      status: 'pending_invite',
    })
    companyId = created.id
  }

  // Create the pending user. status='pending' keeps them out of login (auth.service
  // only activates on first password set, which can't happen until approval) and out
  // of every hydrate roster except an approver's pending view. createUser does its
  // own duplicate-email check and throws a friendly message, no need to pre-check.
  try {
    await store.createUser({
      id: uid('u'),
      company_id: companyId,
      full_name: fullName,
      email,
      user_type: roleMeta(plan.grantedRole)?.userType ?? 'customer',
      role: plan.grantedRole,
      status: 'pending',
    })
  } catch (error: any) {
    throw badRequest(error.message)
  }

  // Notifications are best-effort and independent — fire concurrently. Receipt to
  // the registrant; review alert to the approver set (the company's own admins for
  // an existing company, plus internal admins as a backstop in both cases). Both
  // template renders happen up front so the three fan-outs share one round-trip.
  const [pendingAdminMsg, receipt] = await Promise.all([
    signupPendingAdminEmail(store, { fullName, email, companyName: plan.companyName, newCompany: isNewCompany, reviewLink }),
    signupReceiptEmail(store, { fullName, companyName: plan.companyName, newCompany: isNewCompany }),
  ])
  await Promise.all([
    sendEmail(store, { to: email, ...receipt }).catch(() => {}),
    notifyInternalAdmins(store, pendingAdminMsg).catch(() => {}),
    !isNewCompany && companyId ? notifyCompanyAdmins(store, companyId, pendingAdminMsg).catch(() => {}) : Promise.resolve(),
  ])

  return { ok: true }
}

/** Load a pending user (with company JOIN) for approval/rejection, or throw. */
async function getPendingUser(store: Store, id: string): Promise<any> {
  const user = await store.getUserById(id)
  if (!user) throw notFound('User not found.')
  if (user.status !== 'pending') throw badRequest('This sign-up has already been reviewed.')
  return user
}

/**
 * Approve a pending sign-up: grant the role (default or an approver override), flip
 * the user to `invited`, and email them the set-password link — the exact same path
 * an admin-created invite takes from here on. The company (if it was a new-company
 * request) stays `pending_invite` and goes live when the user sets their first
 * password (auth.service handles that), so a fresh company's first member is its admin.
 */
export async function approveSignup(
  store: Store,
  auth: AuthPayload,
  id: string,
  opts: { role?: Role; origin?: string } = {},
): Promise<any> {
  const user = await getPendingUser(store, id)
  const grantedRole: Role = opts.role ?? user.role
  if (!canApproveSignup(auth, user.companyId, grantedRole)) {
    throw forbidden('You cannot approve this sign-up for that company/role.')
  }
  const updated = await store.update('users', id, {
    status: 'invited',
    role: grantedRole,
    user_type: roleMeta(grantedRole)?.userType ?? user.userType,
    // Record the approver — they're the effective inviter from here on
    // (drives the inviter-accept notification in auth.service).
    invited_by: auth.sub,
  })
  await audit(store, auth, 'user', id, 'approve_signup', { status: 'pending', role: user.role }, { status: 'invited', role: grantedRole })
  // Email the single-use invite link so they set their own password (best-effort).
  await sendInviteLink(store, id, opts.origin).catch(() => {})
  await recomputeOnboardingStatus(store, user.companyId)
  return updated
}

/**
 * Reject a pending sign-up: flip the user to `rejected` (kept for the record, never
 * able to log in) and notify them. Gated by the same check as approval — whoever
 * could approve can reject. A new-company request's `pending_invite` company is left
 * as-is; an internal admin can clean it up from the companies admin if desired.
 */
export async function rejectSignup(store: Store, auth: AuthPayload, id: string, reason?: string): Promise<{ ok: true }> {
  const user = await getPendingUser(store, id)
  // Use the user's current (intended) role for the scope check — rejection doesn't grant a role.
  if (!canApproveSignup(auth, user.companyId, user.role)) {
    throw forbidden('You cannot reject this sign-up.')
  }
  await store.update('users', id, { status: 'rejected' })
  await audit(store, auth, 'user', id, 'reject_signup', { status: 'pending' }, { status: 'rejected', reason: reason ?? null })
  await sendEmail(store, {
    to: user.email,
    ...(await signupRejectedEmail(store, { fullName: user.fullName, companyName: user.companyName ?? null, reason: reason ?? null })),
  }).catch(() => {})
  return { ok: true }
}

/** Public company picklist for the sign-up form (non-sensitive fields only). */
export async function signupCompanyChoices(store: Store): Promise<{ companies: { id: string; companyName: string; companyType: string }[] }> {
  return { companies: await store.listCompanyChoices() }
}
