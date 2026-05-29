import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator as CalcIcon, Lock, Sparkles } from 'lucide-react'
import { publicCalculate } from '../lib/api'
import { Card, RangeBar, StatCard, EmptyState, NumberField } from '../components/ui'
import { fmtUSD } from '../lib/format'
import type { CalcSelection, RoiResult } from '../lib/types'

const DEFAULTS: Required<Pick<CalcSelection, 'currentYieldPct' | 'scrapRate' | 'downtime' | 'costPerWafer' | 'monthlyVolume' | 'excursionCost'>> = {
  currentYieldPct: 82,
  scrapRate: 3.2,
  downtime: 8,
  costPerWafer: 550,
  monthlyVolume: 8000,
  excursionCost: 450000,
}

export default function PublicCalculator() {
  const [sel, setSel] = useState(DEFAULTS)
  const [result, setResult] = useState<RoiResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (p: Partial<typeof DEFAULTS>) => setSel((s) => ({ ...s, ...p }))

  const estimate = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await publicCalculate(sel)
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
        <p className="eyebrow">ROI Score Calculator</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Estimate your savings</h1>
        <p className="mt-2 text-muted dark:text-muted-dark max-w-2xl text-pretty">
          A quick public preview of the Sigenic ROI model. Enter your line's operating conditions to size yield uplift and annual savings.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Inputs */}
        <Card title="Your line">
          <div className="grid sm:grid-cols-2 gap-4">
            <NumberField label="Current yield" unit="%" value={sel.currentYieldPct} onChange={(n) => patch({ currentYieldPct: n })} />
            <NumberField label="Scrap rate" unit="%" value={sel.scrapRate} onChange={(n) => patch({ scrapRate: n })} />
            <NumberField label="Downtime" unit="%" value={sel.downtime} onChange={(n) => patch({ downtime: n })} />
            <NumberField label="Cost / wafer" unit="$" value={sel.costPerWafer} onChange={(n) => patch({ costPerWafer: n })} />
            <NumberField label="Monthly volume" unit="wafers" value={sel.monthlyVolume} onChange={(n) => patch({ monthlyVolume: n })} />
            <NumberField label="Excursion cost" unit="$" value={sel.excursionCost} onChange={(n) => patch({ excursionCost: n })} />
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-5">
            <button className="btn-accent" onClick={estimate} disabled={busy}>
              <CalcIcon size={15} /> {busy ? 'Estimating…' : 'Estimate'}
            </button>
          </div>
        </Card>

        {/* Result */}
        <div className="flex flex-col gap-5">
          {!result ? (
            <Card>
              <EmptyState icon={<Sparkles size={28} />} title="Your estimate appears here" hint="Enter your operating conditions on the left and run the estimate to see your Sigenic score, yield improvement and annual savings range." />
            </Card>
          ) : (
            <Card title="Estimated impact" eyebrow={result.limited ? 'Limited preview' : undefined}>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard label="Sigenic score" value={`${result.score}`} accent />
                <StatCard label="Annual savings" value={fmtUSD(result.annualSavings.min)} sub={`up to ${fmtUSD(result.annualSavings.max)}`} accent />
              </div>

              <div className="space-y-3">
                <RangeBar label="Yield improvement" min={result.yieldImprovement.min} max={result.yieldImprovement.max} format={(n) => `${n}%`} />
                <RangeBar label="Annual savings" min={result.annualSavings.min} max={result.annualSavings.max} format={(n) => fmtUSD(n)} />
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
                  Sign in or request a demo for the full breakdown — scrap, downtime and detection-speed ranges, monthly savings and a downloadable report under the active scoring model.
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
    </div>
  )
}
