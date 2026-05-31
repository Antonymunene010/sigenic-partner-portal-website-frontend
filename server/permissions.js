/**
 * Server-side permission matrix — the single source of truth for authorization.
 *
 * Encodes the PRD "Permission Matrix" (§5) plus the five MVP rules:
 *  1. No multi-customer distributor switching.
 *  2. External users may not manage scoring logic.
 *  3. Ticket execution stays in Zendesk.
 *  4. Company-level visibility by default.
 *  5. Only internal users manage companies / master data / scoring / announcements.
 *
 * The client mirrors this in src/lib/permissions.ts — keep the two in sync.
 */

export const ROLES = [
  'super_admin',
  'admin',
  'support_engineer',
  'distributor_admin',
  'distributor_user',
  'customer_admin',
  'customer_user',
]

export const ROLE_META = {
  super_admin: { userType: 'internal', internal: true, companyAdmin: true, label: 'Super Admin' },
  admin: { userType: 'internal', internal: true, companyAdmin: false, label: 'Admin' },
  support_engineer: { userType: 'internal', internal: true, companyAdmin: false, label: 'Support Engineer' },
  distributor_admin: { userType: 'distributor', internal: false, companyAdmin: true, label: 'Distributor Admin' },
  distributor_user: { userType: 'distributor', internal: false, companyAdmin: false, label: 'Distributor User' },
  customer_admin: { userType: 'customer', internal: false, companyAdmin: true, label: 'Customer Admin' },
  customer_user: { userType: 'customer', internal: false, companyAdmin: false, label: 'Customer User' },
}

const ALL_AUTH = ROLES
const INTERNAL_OVERSIGHT = ['support_engineer', 'admin', 'super_admin']
const INTERNAL_MANAGE = ['admin', 'super_admin']

/**
 * Capability → roles allowed. Data-scope (own company vs all) is enforced
 * separately by companyScope()/canSeeCompany(); these flags answer "is the action
 * available to this role at all?".
 */
const CAPABILITIES = {
  use_full_calculator: ALL_AUTH,
  save_calculator_result: ['customer_user', 'customer_admin', ...INTERNAL_OVERSIGHT],
  download_report: ALL_AUTH,
  view_company_profile: ['distributor_user', 'distributor_admin', 'customer_user', 'customer_admin', 'admin', 'super_admin'],
  view_request_list: ALL_AUTH,
  submit_support_request: ALL_AUTH,
  submit_consultation_request: ALL_AUTH,
  access_knowledge_base: ALL_AUTH,
  manage_company_users: ['distributor_admin', 'customer_admin', 'super_admin'],
  // PRD §5.1 "Manage own company users": for the internal Sigenic company, only
  // super_admin qualifies. A plain admin runs partners/scoring/master data, not staff.
  manage_internal_users: ['super_admin'],
  view_all_companies: INTERNAL_OVERSIGHT,
  manage_companies: INTERNAL_MANAGE,
  view_master_data: INTERNAL_OVERSIGHT,
  manage_master_data: INTERNAL_MANAGE,
  manage_scoring: INTERNAL_MANAGE,
  manage_knowledge: INTERNAL_MANAGE,
  manage_success_stories: INTERNAL_MANAGE,
  view_ticket_oversight: INTERNAL_OVERSIGHT,
  resolve_tickets: INTERNAL_OVERSIGHT,
  manage_announcements: INTERNAL_MANAGE,
  view_audit_logs: INTERNAL_MANAGE,
  view_analytics: INTERNAL_OVERSIGHT,
  manage_billing: INTERNAL_MANAGE,
}

export function isInternal(user) {
  return Boolean(user && ROLE_META[user.role]?.internal)
}

export function roleMeta(role) {
  return ROLE_META[role] ?? null
}

/** True if the role may perform the given capability (ignoring data scope). */
export function can(user, capability) {
  if (!user) return false
  const allowed = CAPABILITIES[capability]
  if (!allowed) return false
  return allowed.includes(user.role)
}

/** Can this user see data belonging to companyId? */
export function canSeeCompany(user, companyId) {
  if (isInternal(user)) return true
  return Boolean(companyId) && companyId === user.companyId
}

/** Roles an actor may assign to others (PRD: external admins restricted to own org type). */
export function assignableRoles(user) {
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

/** Can `actor` create/modify `targetUser` (with intended role)? */
export function canManageUser(actor, targetCompanyId, targetRole) {
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
export function audienceMatches(user, audienceType) {
  if (audienceType === 'all') return true
  if (!user) return false
  if (audienceType === 'internal') return isInternal(user)
  return user.userType === audienceType
}
