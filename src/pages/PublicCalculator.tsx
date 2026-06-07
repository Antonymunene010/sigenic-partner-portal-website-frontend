import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator as CalcIcon, Lock, Send, Sparkles } from 'lucide-react'
import { getPublicCalculatorConfig, publicCalculate, publicSubmitCalculation } from '../lib/api'
import { Card, Field, StatCard, EmptyState, Spinner, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { IssueQuestionnaire } from '../components/IssueQuestionnaire'
import {
  Confirmation,
  ResetButton,
  Stepper,
  TierGuidanceCards,
  WizardFooter,
  type WizardStep,
} from '../components/CalculatorWizard'
import { RISK_TIER_LABEL, RISK_TIER_TONE } from '../lib/constants'
import { defaultIssueInputs, type IssueValues } from '../lib/calculator'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, IssueInput, LimitedRiskResult, PublicCalcConfig } from '../lib/types'

/**
 * Public-facing 3-step wizard — Basic info → Statistical analysis → Additional
 * information (with a required contact card). Mirrors the authenticated wizard
 * in src/pages/Calculator.tsx but emits limited results and routes through
 * /api/public/calculate + /api/public/calculator/submit. Persistence happens
 * ONLY on submit — anonymous previews never reach the admin lead pipeline.
 */
export default function PublicCalculator() {
  const toast = useToast()
  const [config, setConfig] = useState<PublicCalcConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  // Step 1
  const [clientName, setClientName] = useState<string>('')
  const [companyName, setCompanyName] = useState<string>('')
  const [deptId, setDeptId] = useState<string>('')
  const [inputs, setInputs] = useState<Record<string, IssueValues>>({})

  // Step 2
  const [result, setResult] = useState<LimitedRiskResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Step 3
  const [contactName, setContactName] = useState<string>('')
  const [contactEmail, setContactEmail] = useState<string>('')
  const [preventiveMeasures, setPreventiveMeasures] = useState<string>('')
  const [costsIncurred, setCostsIncurred] = useState<string>('')

  const [step, setStep] = useState<WizardStep>(0)
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ runId: string; submittedAt: string; result: LimitedRiskResult } | null>(null)

  useEffect(() => {
    getPublicCalculatorConfig()
      .then(setConfig)
      .catch((e) => setConfigError(e instanceof Error ? e.message : 'Failed to load calculator.'))
  }, [])

  const catalog = useMemo(
    () => (config?.issues ?? []).filter((i) => i.departmentId === deptId).sort((a, b) => a.sortOrder - b.sortOrder),
    [config, deptId],
  )
  const selectedDept = config?.departments.find((d) => d.id === deptId)

  const selectDepartment = (id: string) => {
    setDeptId(id)
    setInputs(defaultIssueInputs((config?.issues ?? []).filter((x) => x.departmentId === id)))
    setResult(null)
  }
  const patchIssue = (id: string, patch: IssueValues) => setInputs((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const buildSelection = (): CalcSelection => ({
    departmentId: deptId,
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
      const res = await publicCalculate(buildSelection())
      setResult(res.result)
      setStep(1)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Estimate failed.', 'error')
    } finally {
      setCalculating(false)
    }
  }

  const submit = async () => {
    if (submitting) return
    // Step-3 required fields. Toast the error AND bounce back to the step the user can fix it on.
    if (!clientName.trim()) {
      toast.push('Client name is required (Step 1).', 'error')
      setStep(0)
      return
    }
    if (!contactEmail.trim()) {
      toast.push('A contact email is required so the Sigenic team can follow up.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await publicSubmitCalculation(
        buildSelection(),
        {
          clientName: clientName.trim(),
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim(),
          companyName: companyName.trim() || undefined,
        },
        {
          preventiveMeasures: preventiveMeasures.trim() || undefined,
          costsIncurred: costsIncurred.trim() || undefined,
        },
      )
      setConfirmation({ runId: res.runId, submittedAt: res.submittedAt, result: res.result })
      toast.push('Submission sent — the Sigenic team has been notified.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Submit failed.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setClientName('')
    setCompanyName('')
    setDeptId('')
    setInputs({})
    setResult(null)
    setContactName('')
    setContactEmail('')
    setPreventiveMeasures('')
    setCostsIncurred('')
    setStep(0)
    setConfirmation(null)
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="eyebrow">Risk Score & Yield Loss</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Estimate your risk & yield loss</h1>
        <p className="mt-2 text-muted dark:text-muted-dark max-w-2xl text-pretty">
          A quick three-step assessment: enter your line's basic information, review the calculated risk band and yield-loss exposure, then submit for the Sigenic team to follow up.
        </p>
      </div>

      {!config ? (
        configError ? (
          <Card>
            <p className="text-sm text-danger">{configError}</p>
          </Card>
        ) : (
          <Spinner />
        )
      ) : confirmation ? (
        <Confirmation
          runId={confirmation.runId}
          submittedAt={confirmation.submittedAt}
          overallRiskScore={confirmation.result.overallRiskScore}
          overallTier={confirmation.result.overallTier}
          totalAnnualValueLoss={confirmation.result.totalAnnualValueLoss}
          onReset={reset}
          extra={<Link to="/login" className="btn-ghost">Partner sign in →</Link>}
        />
      ) : (
        <>
          <Stepper step={step} />

          {step === 0 && (
            <Card title="Step 1 · Basic information">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Client name *">
                  <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your name or contact" />
                </Field>
                <Field label="Company">
                  <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Optional — your organisation" />
                </Field>
                <Field label="Department / template *">
                  <select className="select" value={deptId} onChange={(e) => selectDepartment(e.target.value)}>
                    <option value="">— select —</option>
                    {config.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.technology ? ` · ${d.technology}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Technology">
                  <input className="input" value={selectedDept?.technology ?? ''} readOnly placeholder="—" />
                </Field>
              </div>

              {deptId && catalog.length > 0 && (
                <IssueQuestionnaire
                  catalog={catalog}
                  inputs={inputs}
                  occurrenceOptions={config.occurrenceOptions}
                  detectionOptions={config.detectionOptions}
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
                <AnalysisView result={result} />
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
                Add any context the Sigenic team should know, then share a contact email so they can reach you with a tailored response.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <Field label="Contact name">
                  <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Who should we reply to?" />
                </Field>
                <Field label="Contact email *">
                  <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@company.com" />
                </Field>
              </div>
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

          <Card className="mt-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-emphasis">
                <Lock size={18} />
              </span>
              <div>
                <p className="text-[15px] font-medium">This is a public preview</p>
                <p className="mt-1 text-sm text-muted dark:text-muted-dark text-pretty">
                  Submitting sends a copy of this assessment to the Sigenic team for follow-up. Partner sign-in unlocks the per-issue breakdown and downloadable reports.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/contact" className="btn-outline">Request a demo</Link>
                  <Link to="/login" className="btn-outline">Partner sign in</Link>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function AnalysisView({ result }: { result: LimitedRiskResult }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-4">
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
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted dark:text-muted-dark mb-5">
        <span>{result.tierCounts.high} high</span>
        <span>{result.tierCounts.medium} medium</span>
        <span>{result.tierCounts.low} low</span>
      </div>

      <TierGuidanceCards />
    </>
  )
}
