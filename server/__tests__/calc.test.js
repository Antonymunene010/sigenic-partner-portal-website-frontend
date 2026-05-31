import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRoi, toLimited } from '../calc.js'
import { SEED } from '../seed.js'

// Characterization tests: lock the EXACT current ROI output so the move to
// shared/calc.ts (and any later edit) can't silently change results.
const model = SEED.scoring_models.find((m) => m.id === 'sm-v1')
const rules = SEED.scoring_rules.filter((r) => r.scoring_model_id === 'sm-v1')
const faGlobal = SEED.financial_assumptions.find((a) => a.id === 'fa-global')
const faNova = SEED.financial_assumptions.find((a) => a.id === 'fa-novacell')

test('computeRoi — global baseline (no dept/process/machine), fa-global', () => {
  const result = computeRoi({ model, rules, assumption: faGlobal, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
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
    model, rules, assumption: faNova,
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
    model, rules, assumption: faGlobal,
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
  const result = computeRoi({ model, rules: [], assumption: faGlobal, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
  assert.deepStrictEqual(result.yieldImprovement, { min: 0, max: 0 })
  assert.deepStrictEqual(result.scrapReduction, { min: 0, max: 0 })
  assert.deepStrictEqual(result.monthlySavings, { min: 0, max: 0 })
  assert.deepStrictEqual(result.annualSavings, { min: 0, max: 0 })
  assert.equal(result.score, 0)
})

test('toLimited — exposes only teaser fields, hides breakdown/monthly/assumptions', () => {
  const full = computeRoi({ model, rules, assumption: faGlobal, selection: { currentYieldPct: 88, scrapRate: 3, defectRate: 0.5, downtime: 6 } })
  assert.deepStrictEqual(toLimited(full), {
    modelVersion: 'ROI Model v1.0',
    yieldImprovement: { min: 1.5, max: 4 },
    annualSavings: { min: 623520, max: 1858374 },
    score: 58,
    limited: true,
  })
})
