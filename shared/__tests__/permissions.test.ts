import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROLES,
  can,
  isInternal,
  canSeeCompany,
  assignableRoles,
  canManageUser,
  audienceMatches,
  type Capability,
} from '../permissions'
import type { Role } from '../types'

// Characterization of the PRD §5 permission matrix. These assert human-readable
// facts (not a copy of the CAPABILITIES table) so they double as documentation.

test('roster is the 7 PRD roles', () => {
  assert.deepStrictEqual(ROLES, [
    'super_admin', 'admin', 'support_engineer',
    'distributor_admin', 'distributor_user',
    'customer_admin', 'customer_user',
  ])
})

test('isInternal — only Sigenic staff roles are internal', () => {
  for (const role of ['super_admin', 'admin', 'support_engineer'] as Role[]) assert.equal(isInternal({ role }), true, role)
  for (const role of ['distributor_admin', 'distributor_user', 'customer_admin', 'customer_user'] as Role[]) assert.equal(isInternal({ role }), false, role)
  assert.equal(isInternal(null), false)
})

test('can — null user and unknown capability are always denied', () => {
  assert.equal(can(null, 'use_full_calculator'), false)
  assert.equal(can({ role: 'super_admin' }, 'not_a_capability' as Capability), false)
})

test('can — super_admin holds every internal-management capability', () => {
  for (const cap of ['manage_internal_users', 'manage_scoring', 'manage_request_config', 'manage_companies', 'view_audit_logs', 'manage_announcements', 'manage_billing'] as Capability[]) {
    assert.equal(can({ role: 'super_admin' }, cap), true, cap)
  }
})

test('can — admin runs the business but NOT internal staff (PRD §5.1)', () => {
  assert.equal(can({ role: 'admin' }, 'manage_internal_users'), false)
  // Risk-calculator config is super_admin-only; admin can use the calculator but not configure it.
  assert.equal(can({ role: 'admin' }, 'manage_scoring'), false)
  assert.equal(can({ role: 'admin' }, 'manage_companies'), true)
  assert.equal(can({ role: 'admin' }, 'manage_announcements'), true)
})

test('can — manage_scoring (calculator config) is super_admin-only among internal roles', () => {
  assert.equal(can({ role: 'super_admin' }, 'manage_scoring'), true)
  assert.equal(can({ role: 'admin' }, 'manage_scoring'), false)
  assert.equal(can({ role: 'support_engineer' }, 'manage_scoring'), false)
})

test('can — reclassify_request (request type + site/dept/process/machine) is super_admin-only', () => {
  assert.equal(can({ role: 'super_admin' }, 'reclassify_request'), true)
  // Plain oversight roles can still triage status/owner, but not re-classify.
  assert.equal(can({ role: 'admin' }, 'reclassify_request'), false)
  assert.equal(can({ role: 'support_engineer' }, 'reclassify_request'), false)
  assert.equal(can({ role: 'customer_admin' }, 'reclassify_request'), false)
})

test('can — manage_request_config (request taxonomy) is super_admin-only, decoupled from manage_scoring', () => {
  assert.equal(can({ role: 'super_admin' }, 'manage_request_config'), true)
  assert.equal(can({ role: 'admin' }, 'manage_request_config'), false)
  assert.equal(can({ role: 'support_engineer' }, 'manage_request_config'), false)
})

test('can — support_engineer has oversight but cannot manage config', () => {
  assert.equal(can({ role: 'support_engineer' }, 'view_ticket_oversight'), true)
  assert.equal(can({ role: 'support_engineer' }, 'view_all_companies'), true)
  assert.equal(can({ role: 'support_engineer' }, 'manage_scoring'), false)
  assert.equal(can({ role: 'support_engineer' }, 'manage_companies'), false)
})

test('can — every authenticated role may view success stories', () => {
  for (const role of ROLES) assert.equal(can({ role }, 'view_success_stories'), true, role)
  assert.equal(can(null, 'view_success_stories'), false)
})

test('can — save_calculator_result covers customers + internal oversight, NOT distributors', () => {
  assert.equal(can({ role: 'customer_user' }, 'save_calculator_result'), true)
  assert.equal(can({ role: 'customer_admin' }, 'save_calculator_result'), true)
  assert.equal(can({ role: 'support_engineer' }, 'save_calculator_result'), true)
  assert.equal(can({ role: 'distributor_admin' }, 'save_calculator_result'), false)
  assert.equal(can({ role: 'distributor_user' }, 'save_calculator_result'), false)
})

test('can — external company admins manage their own company users; plain users cannot', () => {
  assert.equal(can({ role: 'distributor_admin' }, 'manage_company_users'), true)
  assert.equal(can({ role: 'customer_admin' }, 'manage_company_users'), true)
  assert.equal(can({ role: 'customer_user' }, 'manage_company_users'), false)
  assert.equal(can({ role: 'distributor_user' }, 'manage_company_users'), false)
})

test('canSeeCompany — internal sees all; external only its own company', () => {
  assert.equal(canSeeCompany({ role: 'admin' }, 'co-x'), true)
  assert.equal(canSeeCompany({ role: 'customer_admin', companyId: 'co-x' }, 'co-x'), true)
  assert.equal(canSeeCompany({ role: 'customer_admin', companyId: 'co-x' }, 'co-y'), false)
  assert.equal(canSeeCompany({ role: 'customer_user', companyId: 'co-x' }, null), false)
})

test('assignableRoles — per the PRD assignment rules', () => {
  assert.deepStrictEqual(assignableRoles({ role: 'super_admin' }), [...ROLES])
  assert.deepStrictEqual(assignableRoles({ role: 'admin' }), ['distributor_admin', 'distributor_user', 'customer_admin', 'customer_user'])
  assert.deepStrictEqual(assignableRoles({ role: 'distributor_admin' }), ['distributor_admin', 'distributor_user'])
  assert.deepStrictEqual(assignableRoles({ role: 'customer_admin' }), ['customer_admin', 'customer_user'])
  assert.deepStrictEqual(assignableRoles({ role: 'customer_user' }), [])
  assert.deepStrictEqual(assignableRoles(null), [])
})

test('canManageUser — super_admin may manage anyone, including internal staff', () => {
  assert.equal(canManageUser({ role: 'super_admin', companyId: 'co-sigenic' }, 'co-sigenic', 'admin'), true)
  assert.equal(canManageUser({ role: 'super_admin', companyId: 'co-sigenic' }, 'co-x', 'customer_user'), true)
})

test('canManageUser — admin manages external roles only, never internal (PRD §5.1)', () => {
  assert.equal(canManageUser({ role: 'admin', companyId: 'co-sigenic' }, 'co-x', 'customer_admin'), true)
  assert.equal(canManageUser({ role: 'admin', companyId: 'co-sigenic' }, 'co-x', 'distributor_user'), true)
  assert.equal(canManageUser({ role: 'admin', companyId: 'co-sigenic' }, 'co-sigenic', 'support_engineer'), false)
  assert.equal(canManageUser({ role: 'admin', companyId: 'co-sigenic' }, 'co-sigenic', 'super_admin'), false)
})

test('canManageUser — external admins scoped to own company AND own org roles', () => {
  assert.equal(canManageUser({ role: 'customer_admin', companyId: 'co-x' }, 'co-x', 'customer_user'), true)
  assert.equal(canManageUser({ role: 'customer_admin', companyId: 'co-x' }, 'co-y', 'customer_user'), false) // other company
  assert.equal(canManageUser({ role: 'customer_admin', companyId: 'co-x' }, 'co-x', 'distributor_user'), false) // wrong org type
  assert.equal(canManageUser({ role: 'distributor_admin', companyId: 'co-d' }, 'co-d', 'distributor_user'), true)
  assert.equal(canManageUser({ role: 'distributor_admin', companyId: 'co-d' }, 'co-d', 'customer_user'), false)
  assert.equal(canManageUser({ role: 'customer_user', companyId: 'co-x' }, 'co-x', 'customer_user'), false) // not a company admin
  assert.equal(canManageUser(null, 'co-x', 'customer_user'), false)
})

test('audienceMatches — all/internal/userType targeting', () => {
  assert.equal(audienceMatches(null, 'all'), true) // "all" ignores the user entirely
  assert.equal(audienceMatches({ role: 'admin', userType: 'internal' }, 'internal'), true)
  assert.equal(audienceMatches({ role: 'customer_user', userType: 'customer' }, 'internal'), false)
  assert.equal(audienceMatches({ role: 'customer_user', userType: 'customer' }, 'customer'), true)
  assert.equal(audienceMatches({ role: 'distributor_user', userType: 'distributor' }, 'customer'), false)
  assert.equal(audienceMatches(null, 'customer'), false)
})
