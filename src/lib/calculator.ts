import type { CalcSelection } from './types'

/**
 * The ROI scoring engine is computed server-side (server/calc.js) — the portal
 * always calls /api/calculate (or /api/public/calculate). Only the default input
 * seed lives client-side.
 */
export function defaultSelection(): CalcSelection {
  return { currentYieldPct: 82, defectRate: 0.6, throughput: 95, scrapRate: 3.2, downtime: 8, costPerWafer: 550, monthlyVolume: 8000, excursionCost: 450000 }
}
