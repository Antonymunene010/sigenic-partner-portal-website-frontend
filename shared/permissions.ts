/**
 * The single authoritative permission matrix, shared by the Node API and the
 * React client. Encodes the PRD "Permission Matrix" (§5) plus the five MVP rules:
 *  1. No multi-customer distributor switching.
 *  2. External users may not manage scoring logic.
 *  3. Ticket execution stays in Zendesk.
 *  4. Company-level visibility is a company-admin privilege; plain external users
 *     see only their own submissions (client feedback 2026-06, supersedes the
 *     original "company-level visibility by default" rule).
 *  5. Only internal users manage companies / master data / scoring / announcements.
 *
 * The server re-checks every mutation against `can`/`canManageUser`; the client
 * uses the same functions to gate navigation and UI affordances (UX, not security).
 */
import type { CompanyType, Role, User, UserType } from './types'

export type Capability =
  | 'use_full_calculator'
  | 'download_report'
  | 'view_company_profile'
  | 'view_request_list'
  | 'submit_support_request'
  | 'submit_consultation_request'
  | 'access_knowledge_base'
  | 'view_success_stories'
  | 'manage_company_users'
  | 'manage_internal_users'
  | 'manage_company_users_global'
  | 'view_all_companies'
  | 'manage_companies'
  | 'manage_scoring'
  | 'manage_knowledge'
  | 'manage_success_stories'
  | 'view_ticket_oversight'
  | 'resolve_tickets'
  | 'reclassify_request'
  | 'manage_request_config'
  | 'manage_email_templates'
  | 'manage_announcements'
  | 'view_audit_logs'
  | 'view_analytics'
  | 'view_calculator_runs'
  | 'view_calculator_history'
  | 'manage_billing'
  // Self-service sign-up review (client feedback 2026-06): gates the cross-company
  // "Sign-up requests" admin page. Set to internal-oversight so support engineers
  // can browse the queue read-only; per-row Approve/Reject still goes through
  // canApproveSignup (= canManageUser), which denies anyone without scope to act.
  | 'view_pending_signups'

export const ROLES: Role[] = [
  'super_admin',
  'admin',
  'support_engineer',
  'distributor_admin',
  'distributor_user',
  'customer_admin',
  'customer_user',
]

export const ROLE_META: Record<Role, { userType: UserType; internal: boolean; companyAdmin: boolean; label: string }> = {
  super_admin: { userType: 'internal', internal: true, companyAdmin: true, label: 'Super Admin' },
  admin: { userType: 'internal', internal: true, companyAdmin: false, label: 'Admin' },
  support_engineer: { userType: 'internal', internal: true, companyAdmin: false, label: 'Support Engineer' },
  distributor_admin: { userType: 'distributor', internal: false, companyAdmin: true, label: 'Distributor Admin' },
  distributor_user: { userType: 'distributor', internal: false, companyAdmin: false, label: 'Distributor User' },
  customer_admin: { userType: 'customer', internal: false, companyAdmin: true, label: 'Customer Admin' },
  customer_user: { userType: 'customer', internal: false, companyAdmin: false, label: 'Customer User' },
}

const ALL_AUTH = ROLES
const EXTERNAL: Role[] = ROLES.filter((r) => !ROLE_META[r].internal)
const INTERNAL_OVERSIGHT: Role[] = ['support_engineer', 'admin', 'super_admin']
export const INTERNAL_MANAGE: Role[] = ['admin', 'super_admin']

/**
 * Capability → roles allowed. Data-scope (own company vs all) is enforced
 * separately by canSeeCompany()/canManageUser(); these flags answer "is the
 * action available to this role at all?".
 */
const CAPABILITIES: Record<Capability, Role[]> = {
  use_full_calculator: ALL_AUTH,
  download_report: ALL_AUTH,
  view_company_profile: ['distributor_user', 'distributor_admin', 'customer_user', 'customer_admin', 'admin', 'super_admin'],
  view_request_list: ALL_AUTH,
  submit_support_request: ALL_AUTH,
  submit_consultation_request: ALL_AUTH,
  access_knowledge_base: ALL_AUTH,
  // Success stories are partner-facing case studies — every authenticated role may
  // browse them (data-scope by visibility is applied in hydrate, not here).
  view_success_stories: ALL_AUTH,
  manage_company_users: ['distributor_admin', 'customer_admin', 'super_admin'],
  // PRD §5.1 "Manage own company users": for the internal Sigenic company, only
  // super_admin qualifies. A plain admin runs partners/scoring/master data, not staff.
  manage_internal_users: ['super_admin'],
  // Cross-company management of external (distributor/customer) users from the
  // admin back office — gates the "All Company Users" tab. canManageUser still
  // enforces per-row scope (admin may not touch internal Sigenic users, etc.),
  // this capability just opens the screen.
  manage_company_users_global: INTERNAL_MANAGE,
  view_all_companies: INTERNAL_OVERSIGHT,
  manage_companies: INTERNAL_MANAGE,
  // Risk-calculator config — the scoring engine (models, issue catalog, the
  // occurrence/detection/price Configuration tables) AND the master-data taxonomy
  // (departments, processes, machines) it builds on. Super_admin only.
  manage_scoring: ['super_admin'],
  manage_knowledge: INTERNAL_MANAGE,
  manage_success_stories: INTERNAL_MANAGE,
  view_ticket_oversight: INTERNAL_OVERSIGHT,
  resolve_tickets: INTERNAL_OVERSIGHT,
  // Re-classify a request after intake — its type plus the request department/
  // process/machine taxonomy. Super_admin only; plain oversight stays status/owner.
  reclassify_request: ['super_admin'],
  // Manage the request-form taxonomy itself (request types + request department/
  // process/machine lists). Its own capability, decoupled from manage_scoring so the
  // request config and the risk-calculator config stay independent. Super_admin only.
  manage_request_config: ['super_admin'],
  // Edit the subject/body templates the server uses for every outbound email
  // (invites, password resets, calculator leads, signup notifications, …). Variable
  // placeholders are fixed by code; super-admins author the wording around them.
  manage_email_templates: ['super_admin'],
  manage_announcements: INTERNAL_MANAGE,
  view_audit_logs: INTERNAL_MANAGE,
  view_analytics: INTERNAL_OVERSIGHT,
  // Calculator leads — the per-run list of who used the calculator (company, contact,
  // risk, yield-loss opportunity) so internal sales can follow up. Same oversight set
  // as analytics; the run itself is persisted server-side on every authenticated calc.
  view_calculator_runs: INTERNAL_OVERSIGHT,
  // Calculator submission history for external users (client feedback 2026-06):
  // company admins see every run from their company, plain users only their own —
  // the data scope is applied in hydrate. Internal staff use the company-wide
  // "Calculator leads" view (view_calculator_runs) instead.
  view_calculator_history: EXTERNAL,
  manage_billing: INTERNAL_MANAGE,
  view_pending_signups: INTERNAL_OVERSIGHT,
}

export function isInternal(user: Pick<User, 'role'> | null | undefined): boolean {
  return Boolean(user && ROLE_META[user.role]?.internal)
}

export function roleMeta(role: Role) {
  return ROLE_META[role] ?? null
}

export function roleLabel(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

/** True if the role may perform the given capability (ignoring data scope). */
export function can(user: Pick<User, 'role'> | null | undefined, capability: Capability): boolean {
  if (!user) return false
  return CAPABILITIES[capability]?.includes(user.role) ?? false
}

/** Can this user see data belonging to companyId? */
export function canSeeCompany(user: Pick<User, 'role' | 'companyId'> | null | undefined, companyId: string | null | undefined): boolean {
  if (isInternal(user)) return true
  return Boolean(companyId) && companyId === user?.companyId
}

/** True for roles that administer their own company (incl. super_admin for Sigenic). */
export function isCompanyAdmin(user: Pick<User, 'role'> | null | undefined): boolean {
  return Boolean(user && ROLE_META[user.role]?.companyAdmin)
}

export type SubmissionScope = 'all' | 'company' | 'own'

/**
 * Visibility scope for company-scoped submissions (service requests, calculator
 * runs) — the single decision point behind both the hydrate SQL filter and the
 * by-id guard below. Internal staff: everything. External company admins: their
 * company's. Plain external users: only their own — company-wide visibility is
 * an admin privilege (client feedback 2026-06).
 */
export function submissionVisibility(user: Pick<User, 'role'> | null | undefined): SubmissionScope {
  if (isInternal(user)) return 'all'
  return isCompanyAdmin(user) ? 'company' : 'own'
}

/** Can this user see / interact with a specific submission? By-id projection of submissionVisibility. */
export function canSeeSubmission(
  user: Pick<User, 'role' | 'companyId'> | null | undefined,
  selfUserId: string | null | undefined,
  record: { companyId?: string | null; userId?: string | null },
): boolean {
  if (!user) return false
  switch (submissionVisibility(user)) {
    case 'all':
      return true
    case 'company':
      return canSeeCompany(user, record.companyId)
    case 'own':
      return Boolean(record.userId && selfUserId) && record.userId === selfUserId
  }
}

/** Roles an actor may assign to others (PRD: external admins restricted to own org type). */
export function assignableRoles(user: Pick<User, 'role'> | null | undefined): Role[] {
  if (!user) return []
  switch (user.role) {
    case 'super_admin':
      return [...ROLES]
    case 'admin':
      // PRD §5.1 "Assign partner/customer roles": admin assigns external roles
      // only. Internal Sigenic staff roles are super_admin's to assign.
      return [...EXTERNAL]
    case 'distributor_admin':
      return ['distributor_admin', 'distributor_user']
    case 'customer_admin':
      return ['customer_admin', 'customer_user']
    default:
      return []
  }
}

/** The admin role a newly-invited company of this type gets by default (its company admin). */
export function primaryAdminRoleForType(type: CompanyType): Role {
  switch (type) {
    case 'distributor':
      return 'distributor_admin'
    case 'customer':
      return 'customer_admin'
    case 'sigenic':
      return 'admin'
  }
}

/** The plain-user (non-admin) role for a partner/customer company type. */
export function plainUserRoleForType(type: CompanyType): Role {
  switch (type) {
    case 'distributor':
      return 'distributor_user'
    case 'customer':
      return 'customer_user'
    // Sigenic doesn't have a "plain user" tier — support_engineer is the closest read-only role.
    case 'sigenic':
      return 'support_engineer'
  }
}

/** Can `actor` create/modify a target user with the intended role/company? */
export function canManageUser(
  actor: Pick<User, 'role' | 'companyId'> | null | undefined,
  targetCompanyId: string | null | undefined,
  targetRole: Role,
): boolean {
  if (!actor) return false
  if (actor.role === 'super_admin') return true
  // PRD §5.1: admin may assign partner/customer (external) roles, but managing
  // internal Sigenic staff is super_admin-only ("Manage own company users": admin ❌).
  if (actor.role === 'admin') return ROLE_META[targetRole]?.internal === false
  // External company admins: only their own company + their own org's roles.
  if (!isCompanyAdmin(actor)) return false
  if (targetCompanyId && targetCompanyId !== actor.companyId) return false
  return assignableRoles(actor).includes(targetRole)
}

/**
 * Self-service sign-up approval (client feedback 2026-06). A pending registrant is
 * approved by whoever could have created them in the first place, so the gate is
 * just canManageUser against the role they'll be granted — no separate capability:
 *  - joining an existing company → their company's admin (or any internal admin);
 *  - a brand-new company / a company with no admin yet → only Sigenic super_admin/
 *    admin, because canManageUser denies an external admin a company that isn't theirs
 *    (and a new-company registrant is the sole member of a pending_invite company, so
 *    no external admin scopes to it). super_admin retains the final override.
 */
export function canApproveSignup(
  approver: Pick<User, 'role' | 'companyId'> | null | undefined,
  targetCompanyId: string | null | undefined,
  grantedRole: Role,
): boolean {
  return canManageUser(approver, targetCompanyId, grantedRole)
}

/**
 * Who may SEE a pending sign-up in their roster (a superset of who may approve it —
 * support engineers get read-only oversight but can't act). Internal staff see every
 * pending registrant (including new-company requests, whose only "company admin" is
 * the registrant themselves); an external company admin sees their own company's.
 */
export function canSeePendingSignup(
  viewer: Pick<User, 'role' | 'companyId'> | null | undefined,
  pendingCompanyId: string | null | undefined,
): boolean {
  if (!viewer) return false
  if (isInternal(viewer)) return true
  return isCompanyAdmin(viewer) && Boolean(pendingCompanyId) && pendingCompanyId === viewer.companyId
}

/** Audience filter for announcements / knowledge by user type. */
export function audienceMatches(user: Pick<User, 'role' | 'userType'> | null | undefined, audienceType: string): boolean {
  if (audienceType === 'all') return true
  if (!user) return false
  if (audienceType === 'internal') return isInternal(user)
  return user.userType === audienceType
}
