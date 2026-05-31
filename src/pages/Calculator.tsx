import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator as CalcIcon, Download, Save, MessageSquarePlus, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData, useLookups } from '../lib/data'
import { can } from '../lib/permissions'
import { calculate, createServiceRequest, downloadReportPdf } from '../lib/api'
import { defaultSelection } from '../lib/calculator'
import { PageHeader } from '../components/PageHeader'
import { Card, Field, RangeBar, StatCard, EmptyState, NumberField, Spinner, useToast } from '../components/ui'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, RoiResult } from '../lib/types'

export default function Calculator() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { departments, processes, machines, sites, refresh, ready } = useData()
  const lookups = useLookups()

  const [sel, setSel] = useState<CalcSelection>(() => ({ ...defaultSelection() }))
  const [result, setResult] = useState<RoiResult | null>(null)
  const [savedRunId, setSavedRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const procOptions = useMemo(() => processes.filter((p) => !sel.departmentId || p.departmentId === sel.departmentId), [processes, sel.departmentId])
  const macOptions = useMemo(
    () => machines.filter((m) => (!sel.departmentId || m.departmentId === sel.departmentId) && (!sel.processId || m.processId === sel.processId || !m.processId)),
    [machines, sel.departmentId, sel.processId],
  )

  const patch = (p: Partial<CalcSelection>) => setSel((s) => ({ ...s, ...p }))

  const run = async (save: boolean) => {
    if (!sel.departmentId) {
      toast.push('Select a department first.', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await calculate(sel, { save })
      setResult(res.result)
      if (res.run) {
        setSavedRunId(res.run.id)
        await refresh()
        toast.push('Result saved to your company.')
      }
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
          estimateId: savedRunId ?? 'estimate',
          generatedAt: new Date().toISOString(),
          context: {
            site: lookups.siteName(sel.siteId),
            department: lookups.departmentName(sel.departmentId),
            process: lookups.processName(sel.processId),
            machine: lookups.machineName(sel.machineId),
          },
          output: result,
        },
        savedRunId ?? 'sigenic-estimate',
      )
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Download failed.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const requestConsultation = async () => {
    if (requesting) return
    setRequesting(true)
    try {
      const r = await createServiceRequest({
        requestType: 'consultation',
        title: `Consultation — ${lookups.departmentName(sel.departmentId)} / ${lookups.machineName(sel.machineId)}`,
        description: `Calculator-driven consultation request. Estimated annual savings ${result ? `${fmtUSD(result.annualSavings.min)}–${fmtUSD(result.annualSavings.max)}` : ''}.`,
        source: 'calculator_cta',
        departmentId: sel.departmentId,
        processId: sel.processId,
        machineId: sel.machineId,
        linkedCalculatorRunId: savedRunId ?? undefined,
      })
      toast.push('Consultation request sent to Sigenic.')
      navigate(`/app/requests/${r.item.id}`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Request failed.', 'error')
    } finally {
      setRequesting(false)
    }
  }

  const canSave = can(user, 'save_calculator_result')

  if (!ready) return <Spinner />

  return (
    <div>
      <PageHeader eyebrow="ROI Score Calculator" title="Estimate your savings" description="Configure your line and operating conditions to estimate yield, scrap, downtime and excursion impact under the active Sigenic scoring model." />

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Inputs */}
        <Card title="Configuration">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Site / fab">
              <select className="select" value={sel.siteId ?? ''} onChange={(e) => patch({ siteId: e.target.value || undefined })}>
                <option value="">— optional —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select className="select" value={sel.departmentId ?? ''} onChange={(e) => patch({ departmentId: e.target.value || undefined, processId: undefined, machineId: undefined })}>
                <option value="">— select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Process">
              <select className="select" value={sel.processId ?? ''} onChange={(e) => patch({ processId: e.target.value || undefined, machineId: undefined })}>
                <option value="">— optional —</option>
                {procOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.processName}</option>
                ))}
              </select>
            </Field>
            <Field label="Machine">
              <select className="select" value={sel.machineId ?? ''} onChange={(e) => patch({ machineId: e.target.value || undefined })}>
                <option value="">— optional —</option>
                {macOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.machineName}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5 stat-label">Operational inputs</div>
          <div className="mt-2 grid sm:grid-cols-2 gap-4">
            <NumberField label="Current yield" unit="%" value={sel.currentYieldPct} onChange={(n) => patch({ currentYieldPct: n })} />
            <NumberField label="Defect rate" unit="%" value={sel.defectRate} onChange={(n) => patch({ defectRate: n })} />
            <NumberField label="Throughput" unit="wph" value={sel.throughput} onChange={(n) => patch({ throughput: n })} />
            <NumberField label="Scrap rate" unit="%" value={sel.scrapRate} onChange={(n) => patch({ scrapRate: n })} />
            <NumberField label="Downtime" unit="%" value={sel.downtime} onChange={(n) => patch({ downtime: n })} />
          </div>

          <div className="mt-5 stat-label">Financial inputs</div>
          <div className="mt-2 grid sm:grid-cols-2 gap-4">
            <NumberField label="Cost / wafer" unit="$" value={sel.costPerWafer} onChange={(n) => patch({ costPerWafer: n })} />
            <NumberField label="Monthly volume" unit="wafers" value={sel.monthlyVolume} onChange={(n) => patch({ monthlyVolume: n })} />
            <NumberField label="Excursion cost" unit="$" value={sel.excursionCost} onChange={(n) => patch({ excursionCost: n })} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-accent" onClick={() => run(false)} disabled={busy}>
              <CalcIcon size={15} /> {busy ? 'Calculating…' : 'Calculate'}
            </button>
            {canSave && (
              <button className="btn-outline" onClick={() => run(true)} disabled={busy}>
                <Save size={15} /> Calculate & save
              </button>
            )}
          </div>
        </Card>

        {/* Result */}
        <div>
          {!result ? (
            <Card>
              <EmptyState icon={<Sparkles size={28} />} title="Your estimate appears here" hint="Configure the line on the left and run the calculator to see yield, savings and detection ranges." />
            </Card>
          ) : (
            <Card title="Estimated impact" eyebrow={result.modelVersion ?? undefined}>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCard label="Sigenic score" value={`${result.score}`} accent />
                <StatCard label="Annual savings" value={fmtUSD(result.annualSavings.min)} sub={`up to ${fmtUSD(result.annualSavings.max)}`} accent />
                <StatCard label="Monthly" value={fmtUSD(result.monthlySavings.min)} sub={`up to ${fmtUSD(result.monthlySavings.max)}`} />
              </div>

              <div className="space-y-3">
                <RangeBar label="Yield improvement" min={result.yieldImprovement.min} max={result.yieldImprovement.max} format={(n) => `${n}%`} />
                <RangeBar label="Scrap reduction" min={result.scrapReduction.min} max={result.scrapReduction.max} format={(n) => `${n}%`} />
                <RangeBar label="Downtime reduction" min={result.downtimeReduction.min} max={result.downtimeReduction.max} format={(n) => `${n}%`} />
                <RangeBar label="Detection speed-up" min={result.detectionSpeedImprovement.min} max={result.detectionSpeedImprovement.max} format={(n) => `${n}%`} />
              </div>

              <div className="mt-5 pt-4 border-t border-line dark:border-line-dark">
                <div className="stat-label mb-2">Monthly breakdown (upper bound)</div>
                <ul className="space-y-1.5">
                  {result.breakdown.map((b) => (
                    <li key={b.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted dark:text-muted-dark">{b.label}</span>
                      <span className="num font-medium">{fmtUSD(b.value)}</span>
                    </li>
                  ))}
                </ul>
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
