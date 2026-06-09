/**
 * Configurable risk-score & yield-loss engine.
 *
 * Faithful re-implementation of the client's "Risk Score & Yield Loss Simulator"
 * spreadsheet. For each issue in a department/template questionnaire the user
 * supplies three inputs — severity (pcs of affected wafers), occurrence (events
 * per year) and detection capability — and we derive:
 *
 *   severityScore  = min(log10(severity) · 1.5, 5)        // Section 1, capped at 5
 *   occurrenceScore = lookup(occurrence)                   // Section 2 (= value)
 *   detectionScore  = lookup(detection)                    // Section 3 (5/3/1)
 *   riskScore       = severityScore + occurrenceScore + detectionScore   // 0–15
 *
 * and the aggregate annual yield loss:
 *
 *   yieldLoss = Σ (severity · occurrence) · pricePerWafer
 *
 * where pricePerWafer is the explicit wafer value, else the technology average.
 * Lookups (occurrence/detection scores, technology prices) are admin-managed data
 * — the spreadsheet's "Configuration" tab — NOT hard-coded magic numbers.
 *
 * This is the single source of truth: the portal always computes server-side
 * (/api/calculate); the client only seeds default inputs.
 */
import type { CalcAdditionalInfo, CalcContact, CalcSelection, DetectionKey, IssueResult, LimitedRiskResult, RiskResult, RiskTier } from './types'

// Severity transform + risk-band thresholds — fixed in the spreadsheet formula.
const SEVERITY_MULTIPLIER = 1.5
const SEVERITY_CAP = 5
const TIER_HIGH = 9 // 9–15 High, 4–8 Medium, 1–3 Low, 0 None
const TIER_MEDIUM = 4
const TIER_LOW = 1

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const round2 = (v: number): number => Math.round(v * 100) / 100
const round0 = (v: number): number => Math.round(v)

/** Map a total risk score (0–15) to its band. */
export function riskTier(score: number): RiskTier {
  if (score >= TIER_HIGH) return 'high'
  if (score >= TIER_MEDIUM) return 'medium'
  if (score >= TIER_LOW) return 'low'
  return 'none'
}

/** Customer-facing tier label — single source of truth for the portal UI and admin emails. */
export const RISK_TIER_LABEL: Record<RiskTier, string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk',
  none: '—',
}

/** Tier score-range copy, kept here so server-rendered docs (emails / PDFs) match the UI. */
export const RISK_TIER_RANGE: Record<RiskTier, string> = {
  high: '9–15',
  medium: '4–8',
  low: '1–3',
  none: '0',
}

/**
 * Recommendation copy shown next to the risk band on the wizard's Statistical Analysis
 * step. Verbatim from the client's reference flow (partner.sigenic.com) — kept in shared/
 * so the calc engine, the wizard, and any server-rendered summary point at one string.
 */
export const RISK_TIER_GUIDANCE: Record<Exclude<RiskTier, 'none'>, string> = {
  high: 'Consider adopting Sigenic Solution.',
  medium: 'May escalate to high risk if ignored.',
  low: 'Tolerable loss, but great saving opportunity.',
}

/** Section-1 severity score: min(log10(severity)·1.5, 5); 0 for non-positive input. */
export function severityScore(severity: number): number {
  if (!(severity > 0)) return 0
  return clamp(Math.log10(severity) * SEVERITY_MULTIPLIER, 0, SEVERITY_CAP)
}

/** A catalog issue as stored — accepts camelCase (API) or snake_case (raw row). */
export interface CalcIssueRow {
  id?: string
  label?: string
}
/** Occurrence option — value (per year) → score (defaults to the value itself). */
export interface OccurrenceRow {
  value?: number
  score?: number
}
/** Detection option — stable key → score. */
export interface DetectionRow {
  key?: string
  score?: number
}
/** Technology price band — avg is the default per-wafer value. */
export interface TechnologyRow {
  technology?: string
  avgPrice?: number
  currency?: string
}

export interface ComputeRiskArgs {
  model?: { id?: string; versionName?: string } | null
  department?: { id?: string; technology?: string | null } | null
  issues?: CalcIssueRow[]
  occurrenceOptions?: OccurrenceRow[]
  detectionOptions?: DetectionRow[]
  technologyPrices?: TechnologyRow[]
  selection?: CalcSelection
}

export function computeRisk({
  model,
  department,
  issues = [],
  occurrenceOptions = [],
  detectionOptions = [],
  technologyPrices = [],
  selection = {},
}: ComputeRiskArgs): RiskResult {
  // Lookups (admin-configurable). Occurrence score defaults to its own value.
  const occMap = new Map<number, number>()
  for (const o of occurrenceOptions) occMap.set(num(o.value), num(o.score, num(o.value)))
  const occScoreFor = (v: number): number => (occMap.has(v) ? (occMap.get(v) as number) : 0)
  const detMap = new Map<string, number>()
  for (const d of detectionOptions) detMap.set(String(d.key), num(d.score))
  const detScoreFor = (k: string): number => detMap.get(k) ?? 0
  const labelById = new Map<string, string>()
  for (const i of issues) if (i.id) labelById.set(i.id, i.label ?? '')

  // Price per wafer: explicit input → technology average → unavailable.
  const techKey = department?.technology ?? null
  const tp = techKey ? technologyPrices.find((t) => t.technology === techKey) : null
  const currency = tp?.currency ?? 'USD'
  const inputWafer = num(selection.waferValue, NaN)
  let pricePerWafer = 0
  let priceSource: RiskResult['priceSource'] = 'unavailable'
  if (Number.isFinite(inputWafer) && inputWafer > 0) {
    pricePerWafer = inputWafer
    priceSource = 'input'
  } else if (tp) {
    pricePerWafer = num(tp.avgPrice)
    priceSource = 'technology_average'
  }

  let totalWaferRaw = 0
  const issueResults: IssueResult[] = (selection.issues ?? []).map((inp) => {
    const severity = num(inp.severity)
    const occurrence = num(inp.occurrence)
    const detection: DetectionKey | null = inp.detection ?? null
    const rawSev = severityScore(severity)
    const rawOcc = occScoreFor(occurrence)
    const rawDet = detection ? detScoreFor(detection) : 0
    const riskRaw = rawSev + rawOcc + rawDet
    const waferLoss = severity * occurrence
    totalWaferRaw += waferLoss
    const label = inp.label || (inp.issueId && labelById.get(inp.issueId)) || 'Issue'
    return {
      issueId: inp.issueId ?? null,
      label,
      severity,
      occurrence,
      detection,
      severityScore: round2(rawSev),
      occurrenceScore: round2(rawOcc),
      detectionScore: round2(rawDet),
      riskScore: round2(riskRaw),
      tier: riskTier(round2(riskRaw)),
      annualWaferLoss: round0(waferLoss),
      annualValueLoss: round0(waferLoss * pricePerWafer),
    }
  })

  // One pass: highest risk score + per-band counts.
  let overallRiskScore = 0
  const tierCounts = { high: 0, medium: 0, low: 0 }
  for (const r of issueResults) {
    if (r.riskScore > overallRiskScore) overallRiskScore = r.riskScore
    if (r.tier !== 'none') tierCounts[r.tier]++
  }

  return {
    modelId: model?.id ?? null,
    modelVersion: model?.versionName ?? null,
    departmentId: department?.id ?? selection.departmentId ?? null,
    technology: techKey,
    pricePerWafer: round2(pricePerWafer),
    priceSource,
    currency,
    issues: issueResults,
    totalAnnualWaferLoss: round0(totalWaferRaw),
    totalAnnualValueLoss: round0(totalWaferRaw * pricePerWafer),
    overallRiskScore,
    overallTier: riskTier(overallRiskScore),
    tierCounts,
  }
}

/**
 * Map a computeRisk() result + selection into a calculator_runs row payload
 * (snake_case columns). `runType` and ownership are supplied by the caller.
 */
export function toCalculatorRun({
  result,
  selection,
  runType,
  model,
  ids = {},
  additional,
  contact,
  clientName,
}: {
  result: RiskResult
  selection: CalcSelection
  runType: string
  model?: { id?: string } | null
  ids?: { companyId?: string | null; siteId?: string | null; userId?: string | null }
  /** Step 3 free-text fields — preventive measures already implemented, costs incurred. */
  additional?: CalcAdditionalInfo | null
  /** Public submissions: contact card filled on Step 3 (required for follow-up). */
  contact?: CalcContact | null
  /** Authenticated submissions can override the displayed client name (defaults: caller's company). */
  clientName?: string | null
}) {
  return {
    company_id: ids.companyId ?? null,
    site_id: ids.siteId ?? null,
    user_id: ids.userId ?? null,
    run_type: runType,
    scoring_model_id: model?.id ?? result.modelId ?? null,
    department_id: selection.departmentId ?? null,
    machine_id: selection.machineId ?? null,
    technology: result.technology,
    wafer_value: result.pricePerWafer,
    price_source: result.priceSource,
    overall_risk_score: result.overallRiskScore,
    overall_tier: result.overallTier,
    total_annual_wafer_loss: result.totalAnnualWaferLoss,
    total_annual_value_loss: result.totalAnnualValueLoss,
    inputs_json: selection.issues ?? [],
    output_summary_json: result,
    client_name: clientName ?? contact?.clientName ?? null,
    contact_name: contact?.contactName ?? null,
    contact_email: contact?.contactEmail ?? null,
    preventive_measures: additional?.preventiveMeasures ?? null,
    costs_incurred: additional?.costsIncurred ?? null,
  }
}

/** Public/limited output — hides per-issue detail, keeps the risk band + headline loss. */
export function toLimited(result: RiskResult): LimitedRiskResult {
  return {
    modelVersion: result.modelVersion,
    departmentId: result.departmentId,
    technology: result.technology,
    overallRiskScore: result.overallRiskScore,
    overallTier: result.overallTier,
    tierCounts: result.tierCounts,
    totalAnnualValueLoss: result.totalAnnualValueLoss,
    currency: result.currency,
    limited: true,
  }
}
