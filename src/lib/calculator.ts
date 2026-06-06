import type { DetectionKey, IssueInput } from './types'

/**
 * The risk-score & yield-loss engine lives in shared/calc.ts (computed
 * server-side) — the portal always calls /api/calculate (or
 * /api/public/calculate). Only the form's default inputs live client-side.
 */

/** Per-issue editable inputs, keyed by issue id in the questionnaire forms. */
export type IssueValues = Pick<IssueInput, 'severity' | 'occurrence' | 'detection'>

/** Minimal shape shared by the hydrate catalog (CalcIssue) and the public config. */
export interface IssueLike {
  id: string
  defaultSeverity?: number | null
  defaultOccurrence?: number | null
  defaultDetection?: DetectionKey | null
}

/** Seed the questionnaire's input map from a department's catalog defaults. */
export function defaultIssueInputs(catalog: IssueLike[]): Record<string, IssueValues> {
  const out: Record<string, IssueValues> = {}
  for (const i of catalog) out[i.id] = { severity: i.defaultSeverity ?? undefined, occurrence: i.defaultOccurrence ?? undefined, detection: i.defaultDetection ?? undefined }
  return out
}
