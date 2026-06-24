import type { CalculatorRun } from './types'

/**
 * Resolve a calculator run's submitter identity. Public (landing-page) runs carry the
 * contact on the row itself; authenticated runs are looked up by userId. Both the admin
 * "Calculator leads" modal and the external "Calculator history" page share these so the
 * fallback chain can't drift between them. Pass the lookups from `useLookups()`.
 */
export function runSubmitterName(run: CalculatorRun, userName: (id?: string | null) => string): string {
  return run.runType === 'public'
    ? run.contactName ?? run.clientName ?? 'Anonymous (public calc)'
    : userName(run.userId)
}

export function runSubmitterEmail(run: CalculatorRun, userEmail: (id?: string | null) => string | null): string | null {
  return run.runType === 'public' ? run.contactEmail ?? null : userEmail(run.userId)
}
