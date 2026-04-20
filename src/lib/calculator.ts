import type { CalcConfig, CalcResult, CalcSelection } from './types'

export function calculate(cfg: CalcConfig, sel: CalcSelection): CalcResult {
  const machine = cfg.machines.find((m) => m.id === sel.machineId)
  if (!machine) throw new Error('Machine not found')

  const processes = sel.processIds
    .map((id) => cfg.processes.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)

  const { costPerWafer, volumePerMonth, costOfExcursion } = sel.business
  const { yieldPct, scrapRate, downtimePct } = sel.operational

  // Diminishing returns on combined optimization factors
  const aggregateOpt = processes.reduce((acc, p) => acc + p.optimizationFactor * (1 - acc), 0)

  // Parameter-driven boost — lower variance/offset improves optimization
  let paramBoost = 0
  for (const p of machine.params) {
    const val = sel.params[p.key] ?? p.default
    const norm = 1 - (val - p.min) / (p.max - p.min)
    paramBoost += Math.max(-0.03, Math.min(0.04, (norm - 0.5) * 0.08))
  }
  paramBoost = Math.max(-0.05, Math.min(0.08, paramBoost))
  const effectiveOpt = Math.max(0, Math.min(0.6, aggregateOpt + paramBoost))

  // Diminishing-returns damping on summed per-process contributions.
  const damp = (total: number) => total * (1 - Math.min(0.3, total * 0.02))
  const yieldImprovementPct = damp(processes.reduce((a, p) => a + p.yieldUpliftPct, 0))
  // Baseline scrap caps how much reduction is achievable — can't reduce more than ~70% of what's there.
  const rawScrapReduction = damp(processes.reduce((a, p) => a + p.scrapReductionPct, 0))
  const scrapReductionPct = Math.min(rawScrapReduction, scrapRate * 0.7)
  const downtimeReductionPct = damp(processes.reduce((a, p) => a + p.downtimeReductionPct, 0))

  // Financial impact
  const baselineMonthlySpend = costPerWafer * volumePerMonth
  const directCostSavings = baselineMonthlySpend * effectiveOpt * 0.35
  const scrapSavings = (scrapReductionPct / 100) * baselineMonthlySpend * 0.45
  // Excursion avoidance — assume 1 excursion / 6 months baseline, scrap reduction scales probability down
  const monthlyExcursionBase = costOfExcursion / 6
  const excursionAvoidance = monthlyExcursionBase * Math.min(0.9, scrapReductionPct / 10)
  // Yield uplift — additional revenue from extra good wafers
  const yieldRevenue = (yieldImprovementPct / 100) * volumePerMonth * cfg.globals.waferRevenue * 0.25

  const grossMonthly = directCostSavings + scrapSavings + excursionAvoidance + yieldRevenue
  const fee = grossMonthly * cfg.globals.serviceFeePct
  const monthlySavings = grossMonthly - fee
  const annualSavings = monthlySavings * 12

  // Operational impact
  const fasterDetectionHrs = Math.round(downtimeReductionPct * 6 + scrapReductionPct * 0.8)
  const manualEffortReductionHrs = Math.round(processes.length * 18 + effectiveOpt * 40)

  const engagementCost = fee * 2 + 35000
  const paybackMonths = monthlySavings > 0 ? engagementCost / monthlySavings : 99

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        effectiveOpt * 140 +
          yieldImprovementPct * 3 +
          scrapReductionPct * 2 +
          downtimeReductionPct * 2 +
          (yieldPct < 85 ? 8 : 0) +
          (scrapRate > 3 ? 5 : 0) +
          (downtimePct > 6 ? 6 : 0) -
          (paybackMonths > 12 ? 10 : 0),
      ),
    ),
  )

  const breakdown = [
    { label: 'Direct process cost reduction', value: directCostSavings },
    { label: 'Scrap avoidance', value: scrapSavings },
    { label: 'Excursion avoidance', value: excursionAvoidance },
    { label: 'Incremental yield revenue', value: yieldRevenue },
    { label: 'Sigenic service fee', value: -fee },
  ]

  return {
    input: sel,
    yieldImprovementPct,
    scrapReductionPct,
    downtimeReductionPct,
    monthlySavings,
    annualSavings,
    fasterDetectionHrs,
    manualEffortReductionHrs,
    paybackMonths,
    score,
    breakdown,
  }
}

export function defaultOperational(): CalcSelection['operational'] {
  return { yieldPct: 82, defectRate: 0.6, throughput: 95, scrapRate: 3.2, downtimePct: 8 }
}

export function defaultBusiness(): CalcSelection['business'] {
  return { costPerWafer: 550, volumePerMonth: 8000, costOfExcursion: 450000 }
}
