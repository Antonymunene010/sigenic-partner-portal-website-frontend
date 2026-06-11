import { useMemo, useState } from 'react'
import { Calculator as CalcIcon, FlaskConical, Send, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { INTERNAL_MANAGE } from '../lib/permissions'
import { useData } from '../lib/data'
import { calculate, submitCalculation } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Card, Field, StatCard, EmptyState, Spinner, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { IssueQuestionnaire } from '../components/IssueQuestionnaire'
import { RiskBreakdownTable } from '../components/RiskBreakdownTable'
import {
  Confirmation,
  ResetButton,
  Stepper,
  TierGuidanceCards,
  WizardFooter,
  type WizardStep,
} from '../components/CalculatorWizard'
import { RISK_TIER_LABEL, RISK_TIER_TONE, DETECTION_LABEL } from '../lib/constants'
import { defaultIssueInputs, type IssueValues } from '../lib/calculator'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, DetectionKey, IssueInput, RiskResult } from '../lib/types'

/**
 * 3-step risk-calculator wizard mirroring the client's standard flow on
 * partner.sigenic.com — Basic info → Statistical analysis → Additional info,
 * then "Submit and Send Email". Only the final submit persists a calculator_run
 * (admin lead); intermediate calculations on Step 2 stay stateless.
 *
 * Shared wizard chrome (Stepper / WizardFooter / ResetButton / TierGuidanceCards /
 * Confirmation) lives in src/components/CalculatorWizard.tsx.
 */
export default function Calculator() {
  const toast = useToast()
  const { user } = useAuth()
  const { departments, machines, sites, calculatorIssues, occurrenceOptions, detectionOptions, technologyPrices, activeScoringModelId, ready } = useData()

  const defaultClient = user?.companyName || user?.fullName || ''

  // Step 1 — basic info + risk inputs.
  const [clientName, setClientName] = useState<string>(defaultClient)
  const [deptId, setDeptId] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>('')
  const [waferValue, setWaferValue] = useState<number | undefined>(undefined)
  const [inputs, setInputs] = useState<Record<string, IssueValues>>({})

  // Step 2 — calculated result preview.
  const [result, setResult] = useState<RiskResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Step 3 — additional information.
  const [preventiveMeasures, setPreventiveMeasures] = useState<string>('')
  const [costsIncurred, setCostsIncurred] = useState<string>('')

  const [step, setStep] = useState<WizardStep>(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ runId: string; submittedAt: string; result: RiskResult } | null>(null)

  const detName = (k: DetectionKey | null | undefined) =>
    k ? detectionOptions.find((d) => d.key === k)?.label ?? DETECTION_LABEL[k] : '—'

  const issuesFor = (id: string) =>
    calculatorIssues
      .filter((i) => i.active && i.scoringModelId === activeScoringModelId && i.departmentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const catalog = useMemo(() => issuesFor(deptId), [calculatorIssues, activeScoringModelId, deptId])
  const machineOptions = useMemo(() => machines.filter((m) => m.departmentId === deptId), [machines, deptId])
  const dept = departments.find((d) => d.id === deptId)
  const techPrice = technologyPrices.find((t) => t.technology === dept?.technology)

  const selectDepartment = (id: string) => {
    setDeptId(id)
    setMachineId('')
    setInputs(defaultIssueInputs(issuesFor(id)))
    setResult(null)
  }
  const patchIssue = (id: string, patch: IssueValues) => setInputs((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const buildSelection = (): CalcSelection => ({
    siteId: siteId || undefined,
    departmentId: deptId || undefined,
    machineId: machineId || undefined,
    waferValue,
    issues: catalog.map<IssueInput>((i) => ({
      issueId: i.id,
      label: i.label,
      severity: inputs[i.id]?.severity,
      occurrence: inputs[i.id]?.occurrence,
      detection: inputs[i.id]?.detection,
    })),
  })

  const goToAnalysis = async () => {
    if (!deptId) {
      toast.push('Select a department first.', 'error')
      return
    }
    setCalculating(true)
    try {
      const res = await calculate(buildSelection())
      setResult(res.result)
      setStep(1)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Calculation failed.', 'error')
    } finally {
      setCalculating(false)
    }
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await submitCalculation(buildSelection(), {
        clientName: clientName.trim() || undefined,
        additional: {
          preventiveMeasures: preventiveMeasures.trim() || undefined,
          costsIncurred: costsIncurred.trim() || undefined,
        },
      })
      setConfirmation({ runId: res.runId, submittedAt: res.submittedAt, result: res.result })
      toast.push('Submission received — a confirmation email is on its way, and the Sigenic team has been notified.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Submit failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setClientName(defaultClient)
    setDeptId('')
    setMachineId('')
    setSiteId('')
    setWaferValue(undefined)
    setInputs({})
    setResult(null)
    setPreventiveMeasures('')
    setCostsIncurred('')
    setStep(0)
    setConfirmation(null)
  }

  if (!ready) return <Spinner />

  return (
    <div>
      <PageHeader
        eyebrow="Risk Score & Yield Loss"
        title="Estimate your risk & yield loss"
        description="A 3-step assessment: enter your line's basic info and score each known issue, review the calculated risk band and yield-loss exposure, then add any preventive measures or costs before submitting to Sigenic."
      />

      {user && INTERNAL_MANAGE.includes(user.role) && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
          <FlaskConical size={16} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Simulation &amp; testing only.</span>{' '}
            You're signed in with a Sigenic admin account — this calculator is intended for partners. Anything you
            submit here will be recorded as a test run, not a real partner enquiry.
          </div>
        </div>
      )}

      {confirmation ? (
        <Confirmation
          runId={confirmation.runId}
          submittedAt={confirmation.submittedAt}
          overallRiskScore={confirmation.result.overallRiskScore}
          overallTier={confirmation.result.overallTier}
          totalAnnualValueLoss={confirmation.result.totalAnnualValueLoss}
          onReset={reset}
        />
      ) : (
        <>
          <Stepper step={step} />

          {step === 0 && (
            <Card title="Step 1 · Basic information">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Client name">
                  <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your organisation" />
                </Field>
                <Field label="Department / template">
                  <select className="select" value={deptId} onChange={(e) => selectDepartment(e.target.value)}>
                    <option value="">— select —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.technology ? ` · ${d.technology}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Primary machine">
                  <select className="select" value={machineId} onChange={(e) => setMachineId(e.target.value)} disabled={!deptId}>
                    <option value="">— optional —</option>
                    {machineOptions.map((m) => (
                      <option key={m.id} value={m.id}>{m.machineName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Site / fab">
                  <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                    <option value="">— optional —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.siteName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Technology">
                  <input className="input" value={dept?.technology ?? ''} readOnly placeholder="—" />
                </Field>
                <Field
                  label="Wafer expected value ($)"
                  hint={techPrice ? `Blank uses ${dept?.technology} average ${fmtUSD(techPrice.avgPrice)}` : dept?.technology ? `No price configured for ${dept.technology}` : 'Optional override'}
                >
                  <input
                    className="input num"
                    type="number"
                    step="any"
                    placeholder={techPrice ? String(techPrice.avgPrice) : ''}
                    value={waferValue ?? ''}
                    onChange={(e) => setWaferValue(e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                </Field>
              </div>

              {!deptId ? (
                <p className="mt-5 text-sm text-muted dark:text-muted-dark">Select a department to load its issue checklist.</p>
              ) : catalog.length === 0 ? (
                <p className="mt-5 text-sm text-muted dark:text-muted-dark">No issues configured for this template yet.</p>
              ) : (
                <IssueQuestionnaire
                  catalog={catalog}
                  inputs={inputs}
                  occurrenceOptions={occurrenceOptions}
                  detectionOptions={detectionOptions}
                  onPatch={patchIssue}
                />
              )}

              <WizardFooter
                left={<ResetButton onReset={reset} />}
                right={
                  <button className="btn-accent" onClick={goToAnalysis} disabled={calculating || !deptId}>
                    <CalcIcon size={15} /> {calculating ? 'Calculating…' : 'Next: Statistical analysis'}
                  </button>
                }
              />
            </Card>
          )}

          {step === 1 && (
            <Card title="Step 2 · Statistical analysis">
              {result ? (
                <AnalysisView result={result} detectionLabel={detName} />
              ) : (
                <EmptyState icon={<Sparkles size={28} />} title="No estimate yet" hint="Go back to Step 1 and complete the questionnaire." />
              )}
              <WizardFooter
                left={
                  <button className="btn-outline" onClick={() => setStep(0)}>
                    ← Back
                  </button>
                }
                right={
                  <div className="flex flex-wrap gap-2 items-center">
                    <ResetButton onReset={reset} />
                    <button className="btn-accent" onClick={() => setStep(2)} disabled={!result}>
                      Next: Additional information →
                    </button>
                  </div>
                }
              />
            </Card>
          )}

          {step === 2 && (
            <Card title="Step 3 · Additional information">
              <p className="text-sm text-muted dark:text-muted-dark mb-4">
                Optional context that helps the Sigenic team prepare a tailored response.
              </p>
              <div className="grid gap-4">
                <Field label="Preventive measures already implemented">
                  <textarea
                    className="input min-h-[88px] py-2"
                    rows={3}
                    value={preventiveMeasures}
                    onChange={(e) => setPreventiveMeasures(e.target.value)}
                    placeholder="e.g. weekly DBC/TBC torque calibration, automated scratch inspection on outgoing wafers…"
                  />
                </Field>
                <Field label="Associated costs incurred">
                  <textarea
                    className="input min-h-[88px] py-2"
                    rows={3}
                    value={costsIncurred}
                    onChange={(e) => setCostsIncurred(e.target.value)}
                    placeholder="e.g. consumable spend per quarter, downtime cost, headcount on rework…"
                  />
                </Field>
              </div>
              <WizardFooter
                left={
                  <button className="btn-outline" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                }
                right={
                  <div className="flex flex-wrap gap-2 items-center">
                    <ResetButton onReset={reset} />
                    <button className="btn-accent" onClick={submit} disabled={submitting}>
                      <Send size={15} /> {submitting ? 'Submitting…' : 'Submit and Send Email'}
                    </button>
                  </div>
                }
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function AnalysisView({ result, detectionLabel }: { result: RiskResult; detectionLabel: (k: DetectionKey | null | undefined) => string }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard
          label="Overall risk score"
          value={`${result.overallRiskScore} / 15`}
          sub={<Badge tone={RISK_TIER_TONE[result.overallTier]}>{RISK_TIER_LABEL[result.overallTier]}</Badge>}
          accent
        />
        <StatCard
          label="Possible yield loss / yr"
          value={fmtUSD(result.totalAnnualValueLoss)}
          sub="scratched-off wafers × occurrence × wafer value"
          accent
        />
        <StatCard label="Wafers at risk / yr" value={result.totalAnnualWaferLoss.toLocaleString()} />
      </div>

      <p className="text-xs text-muted dark:text-muted-dark mb-4">
        Based on {fmtUSD(result.pricePerWafer)} / wafer
        {result.priceSource === 'technology_average' ? ` (${result.technology} average)` : result.priceSource === 'input' ? ' (your input)' : ''}.
      </p>

      <RiskBreakdownTable issues={result.issues} detectionLabel={detectionLabel} />

      <div className="mt-5">
        <TierGuidanceCards />
      </div>
    </>
  )
}
