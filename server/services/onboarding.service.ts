/**
 * Onboarding lifecycle tracker (client feedback 2026-06): system-managed, never
 * hand-set. Recomputed on every relevant mutation — invite sent, invite accepted,
 * company profile edited, non-admin user added — by inspecting the company + its
 * users and picking the highest stage whose conditions are satisfied.
 *
 *   not_started        → freshly created, no admin invite has gone out yet
 *   invited            → the primary admin has been emailed an invite
 *   accepted           → that admin has set their first password
 *   profile_completed  → country, website AND a billing contact are on file
 *   live               → at least one non-admin user is active in the company
 *
 * Idempotent: a no-op when the computed status matches the stored one. Best-effort:
 * a failure here must never fail the underlying mutation (the lifecycle is a UX
 * affordance, not a correctness invariant).
 */

import type { Store } from '../db/store'
import type { OnboardingStatus } from '../../shared/types'

const ADMIN_ROLES = new Set(['distributor_admin', 'customer_admin'])

/** A user shape sufficient for the recomputation — we only read role + status. */
interface UserSnapshot {
  role: string
  status: string
}

/**
 * Pure: pick the highest stage given the company snapshot + its users. Exported
 * for unit tests. The "highest stage whose conditions are met" walk runs from
 * `live` down to `not_started` so the result is monotonically advancing.
 */
export function computeOnboardingStatus(
  company: {
    country?: string | null
    website?: string | null
    billingContactEmail?: string | null
  } | null,
  users: UserSnapshot[],
): OnboardingStatus {
  if (!company) return 'not_started'
  const hasActiveNonAdmin = users.some((u) => u.status === 'active' && !ADMIN_ROLES.has(u.role))
  const profileComplete =
    !!company.country?.trim() && !!company.website?.trim() && !!company.billingContactEmail?.trim()
  const hasAcceptedAdmin = users.some((u) => ADMIN_ROLES.has(u.role) && u.status === 'active')
  const hasInvitedAdmin = users.some((u) => ADMIN_ROLES.has(u.role) && (u.status === 'invited' || u.status === 'active'))

  if (hasActiveNonAdmin) return 'live'
  if (profileComplete && hasAcceptedAdmin) return 'profile_completed'
  if (hasAcceptedAdmin) return 'accepted'
  if (hasInvitedAdmin) return 'invited'
  return 'not_started'
}

/**
 * Recompute and persist a company's onboarding_status if it changed. Safe to call
 * from any service after a mutation that might bear on the lifecycle. Swallows
 * errors so a flaky DB read can't break the calling mutation.
 */
export async function recomputeOnboardingStatus(store: Store, companyId: string | null | undefined): Promise<void> {
  if (!companyId) return
  try {
    const company = await store.getOne('companies', companyId)
    if (!company) return
    const users = (await store.list('users', { where: 'company_id = $1', params: [companyId] })) as UserSnapshot[]
    const next = computeOnboardingStatus(company, users)
    if (next !== company.onboardingStatus) {
      // touch: false — a lifecycle bump shouldn't reorder update-time-sorted lists.
      await store.update('companies', companyId, { onboarding_status: next }, { touch: false })
    }
  } catch {
    /* best-effort */
  }
}
