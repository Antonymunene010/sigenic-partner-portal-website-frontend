import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator as CalcIcon, Lock, Sparkles } from 'lucide-react'
import { getPublicCalculatorConfig, publicCalculate } from '../lib/api'
import { Card, Field, StatCard, EmptyState, Spinner } from '../components/ui'
import { Badge } from '../components/Badge'
import { IssueQuestionnaire } from '../components/IssueQuestionnaire'
import { RISK_TIER_LABEL, RISK_TIER_TONE } from '../lib/constants'
import { defaultIssueInputs, type IssueValues } from '../lib/calculator'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, IssueInput, LimitedRiskResult, PublicCalcConfig } from '../lib/types'

export default function PublicCalculator() {
  const [config, setConfig] = useState<PublicCalcConfig | null>(null)
  const [deptId, setDeptId] = useState<string>('')
  const [inputs, setInputs] = useState<Record<string, IssueValues>>({})
  const [result, setResult] = useState<LimitedRiskResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPublicCalculatorConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load calculator.'))
  }, [])

  const catalog = useMemo(() => (config?.issues ?? []).filter((i) => i.departmentId === deptId).sort((a, b) => a.sortOrder - b.sortOrder), [config, deptId])

  const selectDepartment = (id: string) => {
    setDeptId(id)
    setInputs(defaultIssueInputs((config?.issues ?? []).filter((x) => x.departmentId === id)))
    setResult(null)
  }
  const patchIssue = (id: string, patch: IssueValues) => setInputs((s) => ({ ...s, [id]: { ...s[id], ...patch } }))

  const estimate = async () => {
    if (!deptId) {
      setError('Select a department first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const selection: CalcSelection = {
        departmentId: deptId,
        issues: catalog.map<IssueInput>((i) => ({ issueId: i.id, label: i.label, severity: inputs[i.id]?.severity, occurrence: inputs[i.id]?.occurrence, detection: inputs[i.id]?.detection })),
      }
      const res = await publicCalculate(selection)
      setResult(res.result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Estimate failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-10">
      <div className="mb-6">
        <p className="eyebrow">Risk Score & Yield Loss</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Estimate your risk & yield loss</h1>
        <p className="mt-2 text-muted dark:text-muted-dark max-w-2xl text-pretty">
          A quick public preview of the Sigenic Risk Score & Yield Loss Simulator. Pick a tool, score the known issues, and size the annual yield loss at stake.
        </p>
      </div>

      {!config ? (
        error ? <Card><p className="text-sm text-danger">{error}</p></Card> : <Spinner />
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Inputs */}
          <Card title="Your line">
            <Field label="Department / template">
              <select className="select" value={deptId} onChange={(e) => selectDepartment(e.target.value)}>
                <option value="">— select —</option>
                {config.departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.technology ? ` · ${d.technology}` : ''}</option>
                ))}
              </select>
            </Field>

            {deptId && catalog.length > 0 && (
              <IssueQuestionnaire catalog={catalog} inputs={inputs} occurrenceOptions={config.occurrenceOptions} detectionOptions={config.detectionOptions} onPatch={patchIssue} />
            )}

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-5">
              <button className="btn-accent" onClick={estimate} disabled={busy || !deptId}>
                <CalcIcon size={15} /> {busy ? 'Estimating…' : 'Estimate'}
              </button>
            </div>
          </Card>

          {/* Result */}
          <div className="flex flex-col gap-5">
            {!result ? (
              <Card>
                <EmptyState icon={<Sparkles size={28} />} title="Your estimate appears here" hint="Pick a tool and score its issues to see your overall risk band and the annual yield loss at stake." />
              </Card>
            ) : (
              <Card title="Estimated impact" eyebrow="Limited preview">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard label="Overall risk" value={`${result.overallRiskScore} / 15`} sub={<Badge tone={RISK_TIER_TONE[result.overallTier]}>{RISK_TIER_LABEL[result.overallTier]}</Badge>} accent />
                  <StatCard label="Annual savings opportunity" value={fmtUSD(result.totalAnnualValueLoss)} sub="yield loss at stake" accent />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted dark:text-muted-dark">
                  <span>{result.tierCounts.high} high</span>
                  <span>{result.tierCounts.medium} medium</span>
                  <span>{result.tierCounts.low} low</span>
                </div>
              </Card>
            )}

            {/* Upsell note */}
            <Card>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-emphasis">
                  <Lock size={18} />
                </span>
                <div>
                  <p className="text-[15px] font-medium">This is a limited public preview</p>
                  <p className="mt-1 text-sm text-muted dark:text-muted-dark text-pretty">
                    Sign in or request a demo for the full breakdown — per-issue risk scores, the yield-loss table and a downloadable report under the active scoring model.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/contact" className="btn-accent">Request full analysis</Link>
                    <Link to="/login" className="btn-outline">Partner sign in</Link>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
