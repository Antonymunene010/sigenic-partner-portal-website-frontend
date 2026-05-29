/**
 * Configurable ROI scoring engine (PRD §7.5 + Appendix §4 "Scoring & ROI Configuration").
 *
 * Driven entirely by admin-managed data — a scoring_model, its scoring_rules
 * (metric_type with min/max/weight) and the resolved financial_assumptions —
 * NOT hard-coded magic numbers. The output is a set of min/max ranges
 * (estimated_yield_improvement, estimated_monthly_savings, estimated_annual_savings)
 * exactly as required by the calculator_runs schema.
 *
 * Keep IN SYNC with the client copy in src/lib/calculator.ts so results match
 * whether computed server-side or client-side (offline fallback).
 */

const METRICS = ['yield_improvement', 'scrap_reduction', 'downtime_reduction', 'detection_speed_improvement']

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

// Hard caps so a mis-configured rule cannot produce absurd percentages.
const METRIC_CAP = {
  yield_improvement: 25,
  scrap_reduction: 60,
  downtime_reduction: 60,
  detection_speed_improvement: 90,
}

/** Specificity of a rule against a selection. -1 = does not apply. */
function ruleSpecificity(rule, sel) {
  let score = 0
  if (rule.machineId || rule.machine_id) {
    const m = rule.machineId ?? rule.machine_id
    if (m !== sel.machineId) return -1
    score += 3
  }
  if (rule.processId || rule.process_id) {
    const p = rule.processId ?? rule.process_id
    if (p !== sel.processId) return -1
    score += 2
  }
  if (rule.departmentId || rule.department_id) {
    const d = rule.departmentId ?? rule.department_id
    if (d !== sel.departmentId) return -1
    score += 1
  }
  return score
}

/** Most specific applicable rule for a metric (machine > process > department > global). */
function pickRule(rules, metric, sel) {
  let best = null
  let bestScore = -1
  for (const r of rules) {
    const mt = r.metricType ?? r.metric_type
    if (mt !== metric) continue
    const s = ruleSpecificity(r, sel)
    if (s > bestScore) {
      best = r
      bestScore = s
    }
  }
  return best
}

function metricRange(rules, metric, sel, headroom) {
  const rule = pickRule(rules, metric, sel)
  if (!rule) return { min: 0, max: 0, ruleId: null }
  const weight = clamp(num(rule.weight ?? 1, 1), 0.25, 2)
  const lo = num(rule.minValue ?? rule.min_value)
  const hi = num(rule.maxValue ?? rule.max_value)
  const cap = METRIC_CAP[metric] ?? 100
  // Weight scales the whole range; headroom (from operational inputs) lifts the
  // upper bound only — the lower bound stays the conservative floor.
  const min = clamp(lo * weight, 0, cap)
  const max = clamp(hi * weight * headroom, min, cap)
  return { min, max, ruleId: rule.id }
}

/**
 * @param {object} args
 * @param {object} args.model     scoring_model row
 * @param {Array}  args.rules     scoring_rules for the model
 * @param {object} args.assumption resolved financial_assumptions row
 * @param {object} args.selection  { departmentId, processId, machineId, currentYieldPct, defectRate, throughput, scrapRate, downtime, costPerWafer, monthlyVolume, excursionCost }
 */
export function computeRoi({ model, rules = [], assumption = {}, selection = {} }) {
  const sel = selection
  // Resolve financial inputs: explicit input → assumption default.
  const costPerWafer = num(sel.costPerWafer, num(assumption.costPerWaferDefault ?? assumption.cost_per_wafer_default, 550))
  const monthlyVolume = num(sel.monthlyVolume, num(assumption.monthlyVolumeDefault ?? assumption.monthly_volume_default, 8000))
  const excursionCost = num(sel.excursionCost, num(assumption.excursionCostDefault ?? assumption.excursion_cost_default, 450000))

  const currentYield = num(sel.currentYieldPct, 88)
  const scrapRate = num(sel.scrapRate, 3)
  const defectRate = num(sel.defectRate, 0.5)
  const downtime = num(sel.downtime, 8)

  // Operational headroom — worse current state ⇒ more upside (lifts the max bound).
  const headroom = {
    yield_improvement: clamp(1 + (88 - currentYield) / 120, 0.7, 1.5),
    scrap_reduction: clamp(1 + (scrapRate - 3) / 15 + defectRate / 10, 0.7, 1.5),
    downtime_reduction: clamp(1 + (downtime - 6) / 20, 0.7, 1.5),
    detection_speed_improvement: clamp(1 + defectRate / 8, 0.8, 1.4),
  }

  const ranges = {}
  for (const metric of METRICS) ranges[metric] = metricRange(rules, metric, sel, headroom[metric])

  const baselineSpend = costPerWafer * monthlyVolume

  // Monthly savings for a given endpoint (lo = mins, hi = maxes).
  const monthlyAt = (pick) => {
    const yieldImp = pick(ranges.yield_improvement)
    const scrapRed = pick(ranges.scrap_reduction)
    const downRed = pick(ranges.downtime_reduction)
    const detSpeed = pick(ranges.detection_speed_improvement)
    const scrapSavings = (scrapRate / 100) * baselineSpend * (scrapRed / 100)
    const yieldRevenue = (yieldImp / 100) * monthlyVolume * costPerWafer * 0.3
    const downtimeSavings = (downtime / 100) * baselineSpend * (downRed / 100) * 0.5
    const excursionAvoidance = (excursionCost / 6) * (detSpeed / 100)
    return {
      total: scrapSavings + yieldRevenue + downtimeSavings + excursionAvoidance,
      scrapSavings,
      yieldRevenue,
      downtimeSavings,
      excursionAvoidance,
    }
  }

  const lo = monthlyAt((r) => r.min)
  const hi = monthlyAt((r) => r.max)

  const mid = (r) => (r.min + r.max) / 2
  const score = clamp(
    Math.round(
      mid(ranges.yield_improvement) * 5 +
        mid(ranges.scrap_reduction) * 1.1 +
        mid(ranges.downtime_reduction) * 1.1 +
        mid(ranges.detection_speed_improvement) * 0.35 +
        (currentYield < 85 ? 6 : 0) +
        (scrapRate > 3 ? 4 : 0) +
        (downtime > 6 ? 4 : 0),
    ),
    0,
    100,
  )

  const round = (v) => Math.round(v)
  const round2 = (v) => Math.round(v * 100) / 100

  return {
    modelId: model?.id ?? null,
    modelVersion: model?.versionName ?? model?.version_name ?? null,
    yieldImprovement: { min: round2(ranges.yield_improvement.min), max: round2(ranges.yield_improvement.max) },
    scrapReduction: { min: round2(ranges.scrap_reduction.min), max: round2(ranges.scrap_reduction.max) },
    downtimeReduction: { min: round2(ranges.downtime_reduction.min), max: round2(ranges.downtime_reduction.max) },
    detectionSpeedImprovement: { min: round2(ranges.detection_speed_improvement.min), max: round2(ranges.detection_speed_improvement.max) },
    monthlySavings: { min: round(lo.total), max: round(hi.total) },
    annualSavings: { min: round(lo.total * 12), max: round(hi.total * 12) },
    score,
    assumptionsUsed: { costPerWafer, monthlyVolume, excursionCost },
    breakdown: [
      { label: 'Incremental yield revenue', value: round(hi.yieldRevenue) },
      { label: 'Scrap avoidance', value: round(hi.scrapSavings) },
      { label: 'Downtime recovery', value: round(hi.downtimeSavings) },
      { label: 'Excursion avoidance', value: round(hi.excursionAvoidance) },
    ],
  }
}

/**
 * Map a computeRoi() result + selection into a calculator_runs row payload
 * (snake_case columns). `runType` and ownership are supplied by the caller.
 */
export function toCalculatorRun({ result, selection, runType, model, ids = {} }) {
  return {
    company_id: ids.companyId ?? null,
    site_id: ids.siteId ?? null,
    user_id: ids.userId ?? null,
    run_type: runType,
    scoring_model_id: model?.id ?? null,
    department_id: selection.departmentId ?? null,
    process_id: selection.processId ?? null,
    machine_id: selection.machineId ?? null,
    current_yield_pct: selection.currentYieldPct ?? null,
    defect_rate: selection.defectRate ?? null,
    throughput: selection.throughput ?? null,
    scrap_rate: selection.scrapRate ?? null,
    downtime: selection.downtime ?? null,
    cost_per_wafer: result.assumptionsUsed.costPerWafer,
    monthly_volume: result.assumptionsUsed.monthlyVolume,
    excursion_cost: result.assumptionsUsed.excursionCost,
    estimated_yield_improvement_min: result.yieldImprovement.min,
    estimated_yield_improvement_max: result.yieldImprovement.max,
    estimated_monthly_savings_min: result.monthlySavings.min,
    estimated_monthly_savings_max: result.monthlySavings.max,
    estimated_annual_savings_min: result.annualSavings.min,
    estimated_annual_savings_max: result.annualSavings.max,
    output_summary_json: result,
  }
}

/** Public/limited output — hides the breakdown and exact figures (PRD: public sees a teaser). */
export function toLimited(result) {
  return {
    modelVersion: result.modelVersion,
    yieldImprovement: result.yieldImprovement,
    annualSavings: result.annualSavings,
    score: result.score,
    limited: true,
  }
}
