import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeOnboardingStatus } from '../../../server/services/onboarding.service'

const COMPLETE_PROFILE = { country: 'Singapore', website: 'acme.com', billingContactEmail: 'pay@acme.com' }
const NO_PROFILE = { country: null, website: null, billingContactEmail: null }

test('computeOnboardingStatus — no company ⇒ not_started', () => {
  assert.equal(computeOnboardingStatus(null, []), 'not_started')
})

test('computeOnboardingStatus — company exists but no users ⇒ not_started', () => {
  assert.equal(computeOnboardingStatus(NO_PROFILE, []), 'not_started')
})

test('computeOnboardingStatus — invited admin only ⇒ invited', () => {
  const users = [{ role: 'customer_admin', status: 'invited' }]
  assert.equal(computeOnboardingStatus(NO_PROFILE, users), 'invited')
})

test('computeOnboardingStatus — active admin + no profile ⇒ accepted', () => {
  const users = [{ role: 'customer_admin', status: 'active' }]
  assert.equal(computeOnboardingStatus(NO_PROFILE, users), 'accepted')
})

test('computeOnboardingStatus — active admin + full profile ⇒ profile_completed', () => {
  const users = [{ role: 'customer_admin', status: 'active' }]
  assert.equal(computeOnboardingStatus(COMPLETE_PROFILE, users), 'profile_completed')
})

test('computeOnboardingStatus — active admin + active plain user ⇒ live (even without profile)', () => {
  const users = [
    { role: 'customer_admin', status: 'active' },
    { role: 'customer_user', status: 'active' },
  ]
  assert.equal(computeOnboardingStatus(NO_PROFILE, users), 'live')
})

test('computeOnboardingStatus — distributor admin path mirrors customer admin', () => {
  const users = [{ role: 'distributor_admin', status: 'active' }]
  assert.equal(computeOnboardingStatus(NO_PROFILE, users), 'accepted')
  assert.equal(computeOnboardingStatus(COMPLETE_PROFILE, users), 'profile_completed')
})

// The Sigenic internal org never goes through the external invite flow — its
// onboarding_status is hard-set to 'live' in the seed and isn't touched by this
// helper at runtime (createUser / approveSignup only fire for the external orgs
// the helper applies to). No fixture here.

test('computeOnboardingStatus — only whitespace in profile fields does not count', () => {
  const users = [{ role: 'customer_admin', status: 'active' }]
  const blanks = { country: '  ', website: '', billingContactEmail: null }
  assert.equal(computeOnboardingStatus(blanks, users), 'accepted')
})

test('computeOnboardingStatus — inactive non-admin does not flip to live', () => {
  const users = [
    { role: 'customer_admin', status: 'active' },
    { role: 'customer_user', status: 'invited' }, // not yet activated
  ]
  assert.equal(computeOnboardingStatus(COMPLETE_PROFILE, users), 'profile_completed')
})
