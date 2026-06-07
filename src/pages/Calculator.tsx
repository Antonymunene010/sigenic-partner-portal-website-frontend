import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator as CalcIcon, Download, MessageSquarePlus, Sparkles } from 'lucide-react'
import { useData, useLookups } from '../lib/data'
import { calculate, createServiceRequest, downloadReportPdf } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Card, Field, StatCard, EmptyState, Spinner, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { IssueQuestionnaire } from '../components/IssueQuestionnaire'
import { RiskBreakdownTable } from '../components/RiskBreakdownTable'
import { RISK_TIERS, RISK_TIER_LABEL, RISK_TIER_TONE, DETECTION_LABEL } from '../lib/constants'
import { defaultIssueInputs, type IssueValues } from '../lib/calculator'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, DetectionKey, IssueInput, RiskResult } from '../lib/types'

export default function Calculator() {
  const toast = useToast()
  const navigate = useNavigate()
  const { departments, machines, sites, calculatorIssues, occurrenceOptions, detectionOptions, technologyPrices, activeScoringModelId, ready } = useData()
  const lookups = useLookups()

  const [deptId, setDeptId] = useState<string>('')
  const [machineId, setMachineId] = useState<string>('')
  const [siteId, setSiteId] = useState<string>('')
  const [waferValue, setWaferValue] = useState<number | undefined>(undefined)
  const [inputs, setInputs] = useState<Record<string, IssueValues>>({})
  const [result, setResult] = useState<RiskResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const issuesFor = (id: string) =>
    calculatorIssues
      .filter((i) => i.active && i.scoringModelId === activeScoringModelId && i.departmentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const catalog = useMemo(() => issuesFor(deptId), [calculatorIssues, activeScoringModelId, deptId])
  const machineOptions = useMemo(() => machines.filter((m) => m.departmentId === deptId), [machines, deptId])
  const dept = departments.find((d) => d.id === deptId)
  const techPrice = technologyPrices.find((t) => t.technology === dept?.technology)
  const detName = (k: DetectionKey | null | undefined) => (k ? detectionOptions.find((d) => d.key === k)?.label ?? DETECTION_LABEL[k] : '—')

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
    issues: catalog.map<IssueInput>((i) => ({ issueId: i.id, label: i.label, severity: inputs[i.id]?.severity, occurrence: inputs[i.id]?.occurrence, detection: inputs[i.id]?.detection })),
  })

  const run = async () => {
    if (!deptId) {
      toast.push('Select a department first.', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await calculate(buildSelection())
      setResult(res.result)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Calculation failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const download = async () => {
    if (!result || downloading) return
    setDownloading(true)
    try {
      await downloadReportPdf(
        {
          estimateId: 'estimate',
          generatedAt: new Date().toISOString(),
          context: { site: lookups.siteName(siteId), department: lookups.departmentName(deptId), machine: machineId ? lookups.machineName(machineId) : '—', technology: dept?.technology ?? '—' },
          output: result,
        },
        'sigenic-risk-estimate',
      )
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Download failed.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const requestConsultation = async () => {
    if (requesting || !result) return
    setRequesting(true)
    try {
      const r = await createServiceRequest({
        requestType: 'consultation',
        title: `Consultation — ${lookups.departmentName(deptId)}${machineId ? ` / ${lookups.machineName(machineId)}` : ''}`,
        description: `Calculator-driven consultation. Overall risk ${result.overallRiskScore}/15 (${RISK_TIER_LABEL[result.overallTier]}); estimated annual yield loss ${fmtUSD(result.totalAnnualValueLoss)}.`,
        source: 'calculator_cta',
        departmentId: deptId,
        machineId: machineId || undefined,
      })
      toast.push('Consultation request sent to Sigenic.')
      navigate(`/app/requests/${r.item.id}`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Request failed.', 'error')
    } finally {
      setRequesting(false)
    }
  }

  if (!ready) return <Spinner />

  return (
    <div>
      <PageHeader eyebrow="Risk Score & Yield Loss" title="Estimate your risk & yield loss" description="Pick a tool, score each known issue by severity, occurrence and detection, and see your risk bands and the annual yield loss at stake." />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Inputs */}
        <Card title="Questionnaire">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Department / template">
              <select className="select" value={deptId} onChange={(e) => selectDepartment(e.target.value)}>
                <option value="">— select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}{d.technology ? ` · ${d.technology}` : ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Machine">
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
            <Field label="Wafer value ($)" hint={techPrice ? `Blank uses ${dept?.technology} average ${fmtUSD(techPrice.avgPrice)}` : dept?.technology ? `No price configured for ${dept.technology}` : 'Optional override'}>
              <input className="input num" type="number" step="any" placeholder={techPrice ? String(techPrice.avgPrice) : ''} value={waferValue ?? ''} onChange={(e) => setWaferValue(e.target.value === '' ? undefined : Number(e.target.value))} />
            </Field>
          </div>

          {!deptId ? (
            <p className="mt-5 text-sm text-muted dark:text-muted-dark">Select a department to load its issue checklist.</p>
          ) : catalog.length === 0 ? (
            <p className="mt-5 text-sm text-muted dark:text-muted-dark">No issues configured for this template yet.</p>
          ) : (
            <IssueQuestionnaire catalog={catalog} inputs={inputs} occurrenceOptions={occurrenceOptions} detectionOptions={detectionOptions} onPatch={patchIssue} />
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-accent" onClick={run} disabled={busy || !deptId}>
              <CalcIcon size={15} /> {busy ? 'Calculating…' : 'Calculate'}
            </button>
          </div>
        </Card>

        {/* Result */}
        <div>
          {!result ? (
            <Card>
              <EmptyState icon={<Sparkles size={28} />} title="Your estimate appears here" hint="Score the issues on the left and run the calculator to see per-issue risk bands and the annual yield loss at stake." />
            </Card>
          ) : (
            <Card title="Risk & yield-loss estimate" eyebrow={result.modelVersion ?? undefined}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatCard label="Overall risk" value={`${result.overallRiskScore} / 15`} sub={<Badge tone={RISK_TIER_TONE[result.overallTier]}>{RISK_TIER_LABEL[result.overallTier]}</Badge>} accent />
                <StatCard label="Annual savings opportunity" value={fmtUSD(result.totalAnnualValueLoss)} sub="yield loss at stake" accent />
                <StatCard label="Wafers at risk / yr" value={result.totalAnnualWaferLoss.toLocaleString()} />
              </div>
              <p className="text-xs text-muted dark:text-muted-dark mb-4">
                Based on {fmtUSD(result.pricePerWafer)} / wafer{result.priceSource === 'technology_average' ? ` (${result.technology} average)` : result.priceSource === 'input' ? ' (your input)' : ''}.
              </p>

              <RiskBreakdownTable issues={result.issues} detectionLabel={detName} />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs text-muted dark:text-muted-dark">
                {RISK_TIERS.filter((t) => t.value !== 'none').map((t) => (
                  <span key={t.value} className="inline-flex items-center gap-1.5">
                    <Badge tone={t.tone}>{t.label}</Badge> {t.range}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn-outline" onClick={download} disabled={downloading}>
                  <Download size={15} /> {downloading ? 'Preparing…' : 'Download report'}
                </button>
                <button className="btn-accent" onClick={requestConsultation} disabled={requesting}>
                  <MessageSquarePlus size={15} /> {requesting ? 'Sending…' : 'Request consultation'}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
