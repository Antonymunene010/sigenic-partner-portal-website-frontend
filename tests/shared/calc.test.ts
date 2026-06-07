import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRisk, toLimited, severityScore, riskTier } from '../../shared/calc'

// Characterization tests: lock the risk-score & yield-loss output against the
// client's "Risk Score & Yield Loss Simulator" spreadsheet. Self-contained
// fixtures mirror the sm-v1 seed so this stays independent of the server layer.
const MODEL = { id: 'sm-v1', versionName: 'Risk & Yield Loss v1.0' }
const OCC = [
  { value: 0.25, score: 0.25 }, { value: 0.5, score: 0.5 }, { value: 1, score: 1 },
  { value: 2, score: 2 }, { value: 3, score: 3 }, { value: 4, score: 4 }, { value: 5, score: 5 },
]
const DET = [
  { key: 'unable', score: 5 }, { key: 'partial', score: 3 }, { key: 'system', score: 1 },
]
const TECH = [
  { technology: '200mm', avgPrice: 750 }, { technology: '300mm', avgPrice: 2817 },
]

test('severityScore — min(log10(severity)·1.5, 5), 0 for non-positive', () => {
  assert.equal(severityScore(10000), 5) // capped
  assert.equal(severityScore(1), 0) // log10(1) = 0
  assert.equal(severityScore(0), 0)
  assert.equal(Math.round(severityScore(2000) * 100) / 100, 4.95)
})

test('riskTier — 9–15 high, 4–8 medium, 1–3 low, 0 none', () => {
  assert.equal(riskTier(15), 'high')
  assert.equal(riskTier(9), 'high')
  assert.equal(riskTier(8.99), 'medium')
  assert.equal(riskTier(4), 'medium')
  assert.equal(riskTier(1), 'low')
  assert.equal(riskTier(0.5), 'none')
  assert.equal(riskTier(0), 'none')
})

test('computeRisk — WET/Post-CMP (200mm), explicit wafer value 1 (matches the spreadsheet)', () => {
  const result = computeRisk({
    model: MODEL,
    department: { id: 'dep-wet-cmp', technology: '200mm' },
    occurrenceOptions: OCC,
    detectionOptions: DET,
    technologyPrices: TECH,
    selection: {
      departmentId: 'dep-wet-cmp',
      waferValue: 1,
      issues: [
        { label: 'Brush Torque unstable (DBC/TBC)', severity: 2000, occurrence: 0.25, detection: 'system' },
        { label: 'DIW flow pressure (LD/DBC/TBC/DTC)', severity: 5888, occurrence: 1, detection: 'unable' },
        { label: 'Chem flow rate', severity: 10000, occurrence: 0.5, detection: 'unable' },
        { label: 'Exhaust pressure (DBC/TBC/DTC)', severity: 1500, occurrence: 2, detection: 'system' },
        { label: 'Vacuum level: MT1/2/3', severity: 1500, occurrence: 2, detection: 'partial' },
        { label: 'N2 Flow rate', severity: 1000, occurrence: 4, detection: 'unable' },
        { label: 'N2 Temp', severity: 1000, occurrence: 2, detection: 'system' },
        { label: 'Other issue', severity: 2000, occurrence: 0.5, detection: 'system' },
      ],
    },
  })

  // [label, severityScore, occurrenceScore, detectionScore, riskScore, tier]
  assert.deepStrictEqual(
    result.issues.map((i) => [i.label, i.severityScore, i.occurrenceScore, i.detectionScore, i.riskScore, i.tier]),
    [
      ['Brush Torque unstable (DBC/TBC)', 4.95, 0.25, 1, 6.2, 'medium'],
      ['DIW flow pressure (LD/DBC/TBC/DTC)', 5, 1, 5, 11, 'high'],
      ['Chem flow rate', 5, 0.5, 5, 10.5, 'high'],
      ['Exhaust pressure (DBC/TBC/DTC)', 4.76, 2, 1, 7.76, 'medium'],
      ['Vacuum level: MT1/2/3', 4.76, 2, 3, 9.76, 'high'],
      ['N2 Flow rate', 4.5, 4, 5, 13.5, 'high'],
      ['N2 Temp', 4.5, 2, 1, 7.5, 'medium'],
      ['Other issue', 4.95, 0.5, 1, 6.45, 'medium'],
    ],
  )
  assert.equal(result.totalAnnualWaferLoss, 24388) // Σ severity·occurrence (spreadsheet C33)
  assert.equal(result.totalAnnualValueLoss, 24388) // × wafer value 1
  assert.equal(result.pricePerWafer, 1)
  assert.equal(result.priceSource, 'input')
  assert.equal(result.overallRiskScore, 13.5)
  assert.equal(result.overallTier, 'high')
  assert.deepStrictEqual(result.tierCounts, { high: 4, medium: 4, low: 0 })
  assert.equal(result.modelVersion, 'Risk & Yield Loss v1.0')
})

test('computeRisk — WET/Chem (300mm), technology-average price when no wafer value', () => {
  const result = computeRisk({
    model: MODEL,
    department: { id: 'dep-wet-chem', technology: '300mm' },
    occurrenceOptions: OCC,
    detectionOptions: DET,
    technologyPrices: TECH,
    selection: {
      departmentId: 'dep-wet-chem',
      issues: [
        { label: 'Chemical concentration monitoring', severity: 1000, occurrence: 3, detection: 'partial' },
        { label: 'Other issue', severity: 1000, occurrence: 5, detection: 'unable' },
      ],
    },
  })
  assert.deepStrictEqual(result.issues.map((i) => [i.riskScore, i.tier]), [[10.5, 'high'], [14.5, 'high']])
  assert.equal(result.totalAnnualWaferLoss, 8000) // 1000·3 + 1000·5
  assert.equal(result.pricePerWafer, 2817)
  assert.equal(result.priceSource, 'technology_average')
  assert.equal(result.totalAnnualValueLoss, 8000 * 2817)
})

test('computeRisk — no department/technology ⇒ price unavailable, zero value loss', () => {
  const result = computeRisk({
    model: MODEL,
    department: null,
    occurrenceOptions: OCC,
    detectionOptions: DET,
    technologyPrices: TECH,
    selection: { issues: [{ label: 'X', severity: 1000, occurrence: 2, detection: 'unable' }] },
  })
  assert.equal(result.priceSource, 'unavailable')
  assert.equal(result.pricePerWafer, 0)
  assert.equal(result.totalAnnualWaferLoss, 2000)
  assert.equal(result.totalAnnualValueLoss, 0)
  assert.equal(result.issues[0].riskScore, 11.5) // 4.5 + 2 + 5 — issues still scored without a price
})

test('toLimited — exposes only teaser fields, hides per-issue detail', () => {
  const full = computeRisk({
    model: MODEL,
    department: { id: 'dep-wet-chem', technology: '300mm' },
    occurrenceOptions: OCC,
    detectionOptions: DET,
    technologyPrices: TECH,
    selection: { departmentId: 'dep-wet-chem', issues: [{ label: 'Other issue', severity: 1000, occurrence: 5, detection: 'unable' }] },
  })
  assert.deepStrictEqual(toLimited(full), {
    modelVersion: 'Risk & Yield Loss v1.0',
    departmentId: 'dep-wet-chem',
    technology: '300mm',
    overallRiskScore: 14.5,
    overallTier: 'high',
    tierCounts: { high: 1, medium: 0, low: 0 },
    totalAnnualValueLoss: 1000 * 5 * 2817,
    currency: 'USD',
    limited: true,
  })
})
