/**
 * The single authoritative permission matrix, shared by the Node API and the
 * React client. Encodes the PRD "Permission Matrix" (§5) plus the five MVP rules:
 *  1. No multi-customer distributor switching.
 *  2. External users may not manage scoring logic.
 *  3. Ticket execution stays in Zendesk.
 *  4. Company-level visibility by default.
 *  5. Only internal users manage companies / master data / scoring / announcements.
 *
 * The server re-checks every mutation against `can`/`canManageUser`; the client
 * uses the same functions to gate navigation and UI affordances (UX, not security).
 */
import type { Role, User, UserType } from './types'

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
  | 'view_all_companies'
  | 'manage_companies'
  | 'manage_scoring'
  | 'manage_knowledge'
  | 'manage_success_stories'
  | 'view_ticket_oversight'
  | 'resolve_tickets'
  | 'reclassify_request'
  | 'manage_request_config'
  | 'manage_announcements'
  | 'view_audit_logs'
  | 'view_analytics'
  | 'manage_billing'

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
  manage_announcements: INTERNAL_MANAGE,
  view_audit_logs: INTERNAL_MANAGE,
  view_analytics: INTERNAL_OVERSIGHT,
  manage_billing: INTERNAL_MANAGE,
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

/** Roles an actor may assign to others (PRD: external admins restricted to own org type). */
export function assignableRoles(user: Pick<User, 'role'> | null | undefined): Role[] {
  if (!user) return []
  switch (user.role) {
    case 'super_admin':
      return [...ROLES]
    case 'admin':
      // PRD §5.1 "Assign partner/customer roles": admin assigns external roles
      // only. Internal Sigenic staff roles are super_admin's to assign.
      return ['distributor_admin', 'distributor_user', 'customer_admin', 'customer_user']
    case 'distributor_admin':
      return ['distributor_admin', 'distributor_user']
    case 'customer_admin':
      return ['customer_admin', 'customer_user']
    default:
      return []
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
  const meta = ROLE_META[actor.role]
  if (!meta?.companyAdmin) return false
  if (targetCompanyId && targetCompanyId !== actor.companyId) return false
  return assignableRoles(actor).includes(targetRole)
}

/** Audience filter for announcements / knowledge by user type. */
export function audienceMatches(user: Pick<User, 'role' | 'userType'> | null | undefined, audienceType: string): boolean {
  if (audienceType === 'all') return true
  if (!user) return false
  if (audienceType === 'internal') return isInternal(user)
  return user.userType === audienceType
}
