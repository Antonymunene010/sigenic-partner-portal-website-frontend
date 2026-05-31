/**
 * Client-side permission matrix — mirrors server/permissions.js (the authoritative
 * copy). Used to gate navigation and UI affordances; the server re-checks every
 * mutation, so this is UX, not security.
 */
import type { Role, User, UserType } from './types'

export type Capability =
  | 'use_full_calculator'
  | 'save_calculator_result'
  | 'download_report'
  | 'view_company_profile'
  | 'view_request_list'
  | 'submit_support_request'
  | 'submit_consultation_request'
  | 'access_knowledge_base'
  | 'manage_company_users'
  | 'manage_internal_users'
  | 'view_all_companies'
  | 'manage_companies'
  | 'view_master_data'
  | 'manage_master_data'
  | 'manage_scoring'
  | 'manage_knowledge'
  | 'manage_success_stories'
  | 'view_ticket_oversight'
  | 'resolve_tickets'
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
const INTERNAL_MANAGE: Role[] = ['admin', 'super_admin']

const CAPABILITIES: Record<Capability, Role[]> = {
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

export function isInternal(user: Pick<User, 'role'> | null | undefined): boolean {
  return Boolean(user && ROLE_META[user.role]?.internal)
}

export function can(user: Pick<User, 'role'> | null | undefined, capability: Capability): boolean {
  if (!user) return false
  return CAPABILITIES[capability]?.includes(user.role) ?? false
}

export function roleLabel(role: Role): string {
  return ROLE_META[role]?.label ?? role
}

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

export function audienceMatches(user: Pick<User, 'role' | 'userType'> | null | undefined, audience: string): boolean {
  if (audience === 'all') return true
  if (!user) return false
  if (audience === 'internal') return isInternal(user)
  return user.userType === audience
}
