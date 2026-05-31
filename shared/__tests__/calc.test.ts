import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRoi, toLimited, type CalcRule } from '../calc'

// Characterization tests: lock the EXACT ROI output. Self-contained fixtures
// (mirroring the sm-v1 seed) keep this test independent of the server layer.
const MODEL = { id: 'sm-v1', version_name: 'ROI Model v1.0' }
const RULES: CalcRule[] = [
  { id: 'sr-g-yield', metric_type: 'yield_improvement', min_value: 1.5, max_value: 4.0, weight: 1.0 },
  { id: 'sr-g-scrap', metric_type: 'scrap_reduction', min_value: 8, max_value: 22, weight: 1.0 },
  { id: 'sr-g-down', metric_type: 'downtime_reduction', min_value: 5, max_value: 18, weight: 1.0 },
  { id: 'sr-g-detect', metric_type: 'detection_speed_improvement', min_value: 20, max_value: 60, weight: 1.0 },
  { id: 'sr-litho-yield', department_id: 'dep-litho', metric_type: 'yield_improvement', min_value: 3.0, max_value: 6.5, weight: 1.2 },
  { id: 'sr-euv-detect', department_id: 'dep-litho', machine_id: 'mac-euv-3600', metric_type: 'detection_speed_improvement', min_value: 40, max_value: 75, weight: 1.3 },
  { id: 'sr-etch-scrap', department_id: 'dep-etch', metric_type: 'scrap_reduction', min_value: 12, max_value: 28, weight: 1.15 },
  { id: 'sr-metro-down', department_id: 'dep-metro', metric_type: 'downtime_reduction', min_value: 8, max_value: 24, weight: 1.1 },
]
const FA_GLOBAL = { cost_per_wafer_default: 550, excursion_cost_default: 450000, monthly_volume_default: 8000 }
const FA_NOVA = { cost_per_wafer_default: 610, excursion_cost_default: 520000, monthly_volume_default: 12000 }

test('computeRoi — global baseline (no dept/process/machine), fa-global', () => {
  const result = computeRoi({ model: MODEL, rules: RULES, assumption: FA_GLOBAL, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
  assert.deepStrictEqual(result, {
    modelId: 'sm-v1',
    modelVersion: 'ROI Model v1.0',
    yieldImprovement: { min: 1.5, max: 4 },
    scrapReduction: { min: 8, max: 23.1 },
    downtimeReduction: { min: 5, max: 18 },
    detectionSpeedImprovement: { min: 20, max: 63.75 },
    monthlySavings: { min: 51960, max: 154865 },
    annualSavings: { min: 623520, max: 1858374 },
    score: 58,
    assumptionsUsed: { costPerWafer: 550, monthlyVolume: 8000, excursionCost: 450000 },
    breakdown: [
      { label: 'Incremental yield revenue', value: 52800 },
      { label: 'Scrap avoidance', value: 30492 },
      { label: 'Downtime recovery', value: 23760 },
      { label: 'Excursion avoidance', value: 47813 },
    ],
  })
})

test('computeRoi — litho/EUV overrides + fa-novacell (most specific rules win)', () => {
  const result = computeRoi({
    model: MODEL, rules: RULES, assumption: FA_NOVA,
    selection: { departmentId: 'dep-litho', processId: 'proc-euv', machineId: 'mac-euv-3600', currentYieldPct: 82, scrapRate: 3.2, defectRate: 0.6, downtime: 8 },
  })
  assert.deepStrictEqual(result, {
    modelId: 'sm-v1',
    modelVersion: 'ROI Model v1.0',
    yieldImprovement: { min: 3.6, max: 8.19 },
    scrapReduction: { min: 8, max: 23.61 },
    downtimeReduction: { min: 5, max: 19.8 },
    detectionSpeedImprovement: { min: 52, max: 90 },
    monthlySavings: { min: 157502, max: 371139 },
    annualSavings: { min: 1890022, max: 4453664 },
    score: 99,
    assumptionsUsed: { costPerWafer: 610, monthlyVolume: 12000, excursionCost: 520000 },
    breakdown: [
      { label: 'Incremental yield revenue', value: 179852 },
      { label: 'Scrap avoidance', value: 55312 },
      { label: 'Downtime recovery', value: 57974 },
      { label: 'Excursion avoidance', value: 78000 },
    ],
  })
})

test('computeRoi — etch dept override (scrap reduction), fa-global', () => {
  const result = computeRoi({
    model: MODEL, rules: RULES, assumption: FA_GLOBAL,
    selection: { departmentId: 'dep-etch', currentYieldPct: 85, scrapRate: 5, defectRate: 1.2, downtime: 10 },
  })
  assert.deepStrictEqual(result, {
    modelId: 'sm-v1',
    modelVersion: 'ROI Model v1.0',
    yieldImprovement: { min: 1.5, max: 4.1 },
    scrapReduction: { min: 13.8, max: 40.36 },
    downtimeReduction: { min: 5, max: 21.6 },
    detectionSpeedImprovement: { min: 20, max: 69 },
    monthlySavings: { min: 76160, max: 242176 },
    annualSavings: { min: 913920, max: 2906114 },
    score: 82,
    assumptionsUsed: { costPerWafer: 550, monthlyVolume: 8000, excursionCost: 450000 },
    breakdown: [
      { label: 'Incremental yield revenue', value: 54120 },
      { label: 'Scrap avoidance', value: 88786 },
      { label: 'Downtime recovery', value: 47520 },
      { label: 'Excursion avoidance', value: 51750 },
    ],
  })
})

test('computeRoi — no applicable rules ⇒ all-zero ranges and savings', () => {
  const result = computeRoi({ model: MODEL, rules: [], assumption: FA_GLOBAL, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
  assert.deepStrictEqual(result.yieldImprovement, { min: 0, max: 0 })
  assert.deepStrictEqual(result.scrapReduction, { min: 0, max: 0 })
  assert.deepStrictEqual(result.monthlySavings, { min: 0, max: 0 })
  assert.deepStrictEqual(result.annualSavings, { min: 0, max: 0 })
  assert.equal(result.score, 0)
})

test('toLimited — exposes only teaser fields, hides breakdown/monthly/assumptions', () => {
  const full = computeRoi({ model: MODEL, rules: RULES, assumption: FA_GLOBAL, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
  assert.deepStrictEqual(toLimited(full), {
    modelVersion: 'ROI Model v1.0',
    yieldImprovement: { min: 1.5, max: 4 },
    annualSavings: { min: 623520, max: 1858374 },
    score: 58,
    limited: true,
  })
})
