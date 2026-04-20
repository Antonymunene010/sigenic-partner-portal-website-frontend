import type { CalcConfig, CalcResult, CalcSelection } from './types'

export function calculate(cfg: CalcConfig, sel: CalcSelection): CalcResult {
  const machine = cfg.machines.find((m) => m.id === sel.machineId)
  if (!machine) throw new Error('Machine not found')

  const processes = sel.processIds
    .map((id) => cfg.processes.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)

  const baselinePerWafer = machine.baselineCostPerWafer
  const baselineMonthly = baselinePerWafer * sel.wafersPerMonth

  // Aggregate optimization from selected processes with diminishing returns
  const aggregateOpt = processes.reduce((acc, p) => acc + p.optimizationFactor * (1 - acc), 0)
  const yieldUplift = processes.reduce((acc, p) => acc + p.yieldUpliftPct, 0)

  // Parameter-driven adjustment: lower variance/offset -> better optimization
  let paramBoost = 0
  for (const p of machine.params) {
    const val = sel.params[p.key] ?? p.default
    // Normalized 0..1 where lower-than-default is better; for metrics like sampleRate higher is better — we approximate with absolute distance
    const range = p.max - p.min
    const norm = 1 - (val - p.min) / range // 1 when val==min, 0 when val==max
    paramBoost += Math.max(-0.03, Math.min(0.04, (norm - 0.5) * 0.08))
  }
  paramBoost = Math.max(-0.05, Math.min(0.08, paramBoost))

  const effectiveOpt = Math.max(0, Math.min(0.6, aggregateOpt + paramBoost))

  const optimizedPerWafer = baselinePerWafer * (1 - effectiveOpt)
  const optimizedMonthly = optimizedPerWafer * sel.wafersPerMonth

  // Yield uplift adds extra good wafers, contributing to additional savings from avoided scrap
  const scrapSavings = (yieldUplift / 100) * baselineMonthly * 0.35

  const throughputProcess = processes.find((p) => p.id === 'p-throughput')
  const throughputUplift = throughputProcess ? 0.18 : 0

  const grossSavings = (baselineMonthly - optimizedMonthly) + scrapSavings
  const fee = grossSavings * cfg.globals.serviceFeePct
  const netSavingsMonthly = grossSavings - fee
  const netSavingsAnnual = netSavingsMonthly * 12

  // Crude payback: assume one-time engagement cost = 2 months of fee run-rate + $35k
  const engagementCost = fee * 2 + 35000
  const paybackMonths = netSavingsMonthly > 0 ? engagementCost / netSavingsMonthly : 99

  const score = Math.round(
    Math.max(0, Math.min(100,
      (effectiveOpt * 180) + (yieldUplift * 4) + (throughputUplift * 80) - (paybackMonths > 12 ? 10 : 0)
    ))
  )

  const breakdown = [
    { label: 'Process cost reduction', value: baselineMonthly - optimizedMonthly },
    { label: 'Scrap avoidance from yield', value: scrapSavings },
    { label: 'Axiom service fee', value: -fee },
  ]

  return {
    input: sel,
    baselineCostMonthly: baselineMonthly,
    optimizedCostMonthly: optimizedMonthly,
    savingsMonthly: netSavingsMonthly,
    savingsAnnual: netSavingsAnnual,
    yieldUpliftPct: yieldUplift,
    throughputUpliftPct: throughputUplift * 100,
    paybackMonths,
    score,
    breakdown,
  }
}
