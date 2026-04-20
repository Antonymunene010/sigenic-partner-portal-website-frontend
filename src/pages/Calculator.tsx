import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Calculator as CalcIcon, CheckCircle2, Layers, Sliders, Factory, Sparkles, RotateCcw, Printer } from 'lucide-react'
import { load, save } from '../lib/storage'
import type { CalcConfig, CalcResult, Machine, Process } from '../lib/types'
import { seedCalc } from '../lib/seed'
import { calculate } from '../lib/calculator'
import { PageHeader } from '../components/PageHeader'
import { fmtNumber, fmtUSD } from '../lib/format'
import clsx from 'clsx'

type Step = 0 | 1 | 2 | 3

const STEPS = [
  { id: 0, label: 'Machine', icon: Factory },
  { id: 1, label: 'Processes', icon: Layers },
  { id: 2, label: 'Volume & params', icon: Sliders },
  { id: 3, label: 'Results', icon: Sparkles },
] as const

export default function Calculator() {
  const cfg = load<CalcConfig>('calc', seedCalc)
  const [step, setStep] = useState<Step>(0)
  const [machineId, setMachineId] = useState<string>(cfg.machines[0]?.id ?? '')
  const [processIds, setProcessIds] = useState<string[]>([])
  const machine = cfg.machines.find((m) => m.id === machineId) as Machine | undefined

  const compatibleProcesses = useMemo(
    () => cfg.processes.filter((p) => p.compatibleMachines.includes(machineId)),
    [cfg.processes, machineId],
  )

  const [params, setParams] = useState<Record<string, number>>(() => {
    const m = cfg.machines[0]
    if (!m) return {}
    return Object.fromEntries(m.params.map((p) => [p.key, p.default]))
  })
  const [wafersPerMonth, setWpm] = useState(8000)
  const [hoursPerDay, setHpd] = useState(22)
  const [daysPerMonth, setDpm] = useState(28)
  const [result, setResult] = useState<CalcResult | null>(null)

  const reset = () => {
    setStep(0)
    setMachineId(cfg.machines[0]?.id ?? '')
    setProcessIds([])
    setParams({})
    setWpm(8000); setHpd(22); setDpm(28)
    setResult(null)
  }

  const next = () => {
    if (step === 0 && !machineId) return
    if (step === 1 && processIds.length === 0) return
    if (step === 2) {
      const r = calculate(cfg, {
        machineId, processIds, params,
        wafersPerMonth, hoursPerDay, daysPerMonth,
      })
      setResult(r)
      save('calc.latest', { savingsAnnual: r.savingsAnnual, score: r.score, at: new Date().toISOString() })
      setStep(3)
      return
    }
    setStep(((step as number) + 1) as Step)
  }
  const prev = () => setStep(Math.max(0, (step as number) - 1) as Step)

  const changeMachine = (id: string) => {
    setMachineId(id)
    // Reset incompatible choices
    const compat = cfg.processes.filter((p) => p.compatibleMachines.includes(id)).map((p) => p.id)
    setProcessIds((ps) => ps.filter((pid) => compat.includes(pid)))
    const m = cfg.machines.find((mm) => mm.id === id)
    if (m) {
      const defaults: Record<string, number> = {}
      for (const p of m.params) defaults[p.key] = p.default
      setParams(defaults)
    }
  }

  const toggleProcess = (id: string) =>
    setProcessIds((xs) => (xs.includes(id) ? xs.filter((v) => v !== id) : [...xs, id]))

  return (
    <div>
      <PageHeader
        eyebrow="Score calculator · cost-savings model"
        title={
          <>
            Model your next <span className="font-serif italic font-normal">engagement</span>.
          </>
        }
        description="Pick a machine, select the processes you'd tune, configure volume and parameters — we'll estimate monthly and annual savings, payback, and a composite score."
        actions={
          step === 3 && (
            <div className="flex gap-2">
              <button onClick={reset} className="btn-outline"><RotateCcw size={13} /> New estimate</button>
              <button onClick={() => window.print()} className="btn-outline"><Printer size={13} /> Print</button>
            </div>
          )
        }
      />

      {/* Stepper */}
      <div className="card p-1 mb-6 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[520px]">
          {STEPS.map((s, i) => {
            const active = step === s.id
            const done = step > s.id
            return (
              <button
                key={s.id}
                onClick={() => (done ? setStep(s.id as Step) : undefined)}
                className={clsx(
                  'flex-1 h-10 px-3 rounded-md flex items-center gap-2 text-[12.5px] transition',
                  active && 'bg-raised dark:bg-raised-dark text-ink dark:text-ink-dark',
                  !active && done && 'text-muted dark:text-muted-dark hover:bg-raised/60 dark:hover:bg-raised-dark/60 cursor-pointer',
                  !active && !done && 'text-faint dark:text-faint-dark cursor-default',
                )}
              >
                <span className={clsx(
                  'w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono font-medium',
                  active ? 'bg-accent text-accent-ink' : done ? 'bg-ink text-canvas dark:bg-ink-dark dark:text-canvas-dark' : 'border border-line dark:border-line-dark',
                )}>
                  {done ? <CheckCircle2 size={11} strokeWidth={2.5} /> : i + 1}
                </span>
                <span className="font-medium">{s.label}</span>
                {i < STEPS.length - 1 && <span className="ml-auto text-faint dark:text-faint-dark">→</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Steps */}
      {step === 0 && (
        <section className="animate-fade-up">
          <h2 className="text-[18px] font-semibold tracking-tight mb-1">Select a machine</h2>
          <p className="text-[13px] text-muted dark:text-muted-dark mb-5">Start with the tool family you'd like to optimize.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {cfg.machines.map((m) => (
              <button
                key={m.id}
                onClick={() => changeMachine(m.id)}
                className={clsx(
                  'text-left card p-5 transition',
                  machineId === m.id
                    ? 'border-ink dark:border-ink-dark shadow-soft'
                    : 'hover:border-line-strong dark:hover:border-line-strong-dark',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted dark:text-muted-dark">
                      {m.family} · {m.node}
                    </div>
                    <div className="mt-1.5 text-[17px] font-semibold tracking-tight">{m.name}</div>
                  </div>
                  {machineId === m.id && (
                    <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <CheckCircle2 size={13} className="text-accent-ink" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Mini label="Baseline / wafer" value={fmtUSD(m.baselineCostPerWafer)} />
                  <Mini label="Throughput" value={`${m.defaultThroughput} w/hr`} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && machine && (
        <section className="animate-fade-up">
          <h2 className="text-[18px] font-semibold tracking-tight mb-1">Select processes to optimize</h2>
          <p className="text-[13px] text-muted dark:text-muted-dark mb-5">
            Only processes compatible with <span className="font-mono text-ink dark:text-ink-dark">{machine.name}</span> are shown. Pick one or more.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {compatibleProcesses.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleProcess(p.id)}
                className={clsx(
                  'text-left card p-4 transition',
                  processIds.includes(p.id)
                    ? 'border-ink dark:border-ink-dark shadow-soft'
                    : 'hover:border-line-strong dark:hover:border-line-strong-dark',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14.5px] font-medium tracking-tight">{p.name}</div>
                    <div className="mt-1 text-[12px] text-muted dark:text-muted-dark">
                      {p.stepCount} steps · complexity {p.complexity}/5
                    </div>
                  </div>
                  <span className={clsx(
                    'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                    processIds.includes(p.id)
                      ? 'bg-accent border-accent'
                      : 'border-line-strong dark:border-line-strong-dark',
                  )}>
                    {processIds.includes(p.id) && <CheckCircle2 size={13} className="text-accent-ink" strokeWidth={2.5} />}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[11.5px]">
                  <Pill label="Opt factor" value={`${Math.round(p.optimizationFactor * 100)}%`} accent />
                  <Pill label="Yield +" value={`${p.yieldUpliftPct.toFixed(1)}%`} />
                </div>
              </button>
            ))}
          </div>
          {compatibleProcesses.length === 0 && (
            <div className="card p-8 text-center text-[13px] text-muted dark:text-muted-dark">
              No compatible processes — pick a different machine.
            </div>
          )}
        </section>
      )}

      {step === 2 && machine && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-up">
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sliders size={14} className="text-muted dark:text-muted-dark" />
                <h3 className="text-[14px] font-medium">Production volume</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberField label="Wafers per month" value={wafersPerMonth} set={setWpm} min={100} max={50000} step={100} unit="wafers" />
                <NumberField label="Operating hours / day" value={hoursPerDay} set={setHpd} min={1} max={24} step={1} unit="hrs" />
                <NumberField label="Operating days / month" value={daysPerMonth} set={setDpm} min={1} max={31} step={1} unit="days" />
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Factory size={14} className="text-muted dark:text-muted-dark" />
                <h3 className="text-[14px] font-medium">{machine.name} parameters</h3>
              </div>
              <div className="space-y-5">
                {machine.params.map((p) => (
                  <div key={p.key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="label mb-0">{p.label}</label>
                      <span className="font-mono num text-[13px]">
                        {fmtNumber(params[p.key] ?? p.default, p.step < 1 ? 1 : 0)} <span className="text-faint dark:text-faint-dark">{p.unit}</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={params[p.key] ?? p.default}
                      onChange={(e) => setParams((x) => ({ ...x, [p.key]: +e.target.value }))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-faint dark:text-faint-dark mt-1">
                      <span>{p.min}{p.unit}</span>
                      <span>default {p.default}{p.unit}</span>
                      <span>{p.max}{p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="stat-label">Selected</div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-[11px] text-muted dark:text-muted-dark">Machine</div>
                  <div className="text-[14px] font-medium mt-0.5">{machine.name}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted dark:text-muted-dark">Processes ({processIds.length})</div>
                  <ul className="mt-1 space-y-0.5">
                    {processIds.map((pid) => {
                      const p = cfg.processes.find((pp) => pp.id === pid)
                      return <li key={pid} className="text-[12.5px]">· {p?.name}</li>
                    })}
                  </ul>
                </div>
                <div>
                  <div className="text-[11px] text-muted dark:text-muted-dark">Baseline annual spend</div>
                  <div className="text-[18px] font-semibold tracking-tight num mt-0.5">
                    {fmtUSD(machine.baselineCostPerWafer * wafersPerMonth * 12)}
                  </div>
                </div>
              </div>
            </div>
            <div className="card p-4 text-[11.5px] text-muted dark:text-muted-dark leading-relaxed">
              <strong className="text-ink dark:text-ink-dark font-medium">Heads up.</strong> Estimates use baseline assumptions plus parameter-driven adjustments. Validate with a short pilot before capacity planning.
            </div>
          </aside>
        </section>
      )}

      {step === 3 && result && machine && (
        <ResultView result={result} machine={machine} processes={cfg.processes.filter((p) => processIds.includes(p.id))} />
      )}

      {/* Footer nav */}
      {step < 3 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={13} /> Back
          </button>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark">
            Step {(step as number) + 1} of {STEPS.length}
          </div>
          <button
            onClick={next}
            disabled={
              (step === 0 && !machineId) ||
              (step === 1 && processIds.length === 0)
            }
            className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 2 ? (
              <>
                <CalcIcon size={13} /> Calculate
              </>
            ) : (
              <>
                Continue <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-faint dark:text-faint-dark font-mono">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-mono num">{value}</div>
    </div>
  )
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-faint dark:text-faint-dark font-mono uppercase tracking-[0.1em] text-[9.5px]">{label}</span>
      <span className={clsx('font-mono num font-medium', accent ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark')}>{value}</span>
    </div>
  )
}

function NumberField({ label, value, set, min, max, step, unit }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; unit: string
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => set(Math.max(min, Math.min(max, +e.target.value || min)))}
          className="input pr-14 font-mono num"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
          {unit}
        </span>
      </div>
    </div>
  )
}

function ResultView({ result, machine, processes }: { result: CalcResult; machine: Machine; processes: Process[] }) {
  const scoreColor = result.score >= 70 ? 'text-success' : result.score >= 40 ? 'text-warn' : 'text-danger'
  const maxAbs = Math.max(...result.breakdown.map((b) => Math.abs(b.value)))

  return (
    <div className="animate-fade-up">
      {/* Hero result */}
      <div className="card-raised overflow-hidden relative mb-5">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="md:col-span-2 p-8 border-b md:border-b-0 md:border-r border-line dark:border-line-dark">
            <div className="eyebrow mb-3">Estimated outcome</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-[56px] md:text-[72px] font-semibold tracking-tightest num leading-none text-ink dark:text-ink-dark">
                {fmtUSD(result.savingsAnnual)}
              </div>
              <div className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted dark:text-muted-dark">
                net savings / year
              </div>
            </div>
            <div className="mt-2 text-[14px] text-muted dark:text-muted-dark">
              {fmtUSD(result.savingsMonthly)} / month · payback {result.paybackMonths.toFixed(1)} months
            </div>

            <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Yield uplift" value={`+${result.yieldUpliftPct.toFixed(1)}%`} />
              <Stat label="Cost / wafer" value={fmtUSD(result.optimizedCostMonthly / result.input.wafersPerMonth, { cents: true })} sub={`vs ${fmtUSD(result.baselineCostMonthly / result.input.wafersPerMonth, { cents: true })} baseline`} />
              <Stat label="Throughput" value={`+${result.throughputUpliftPct.toFixed(0)}%`} />
              <Stat label="Monthly spend" value={fmtUSD(result.optimizedCostMonthly)} sub={`−${fmtUSD(result.baselineCostMonthly - result.optimizedCostMonthly)}`} />
            </div>
          </div>

          <div className="p-8 relative">
            <div className="eyebrow mb-3">Axiom Score</div>
            <ScoreDial score={result.score} />
            <div className={clsx('text-center mt-3 text-[12px] font-medium', scoreColor)}>
              {result.score >= 70 ? 'Strong fit · fast payback' : result.score >= 40 ? 'Solid · consider pilot' : 'Marginal · re-scope'}
            </div>
            <div className="text-center text-[11px] text-muted dark:text-muted-dark mt-1 leading-relaxed">
              Composite of savings, yield uplift, and payback.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Breakdown */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-[14px] font-medium mb-4">Savings breakdown · monthly</h3>
          <ul className="space-y-3.5">
            {result.breakdown.map((b) => {
              const pct = (Math.abs(b.value) / maxAbs) * 100
              const negative = b.value < 0
              return (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[13px]">{b.label}</span>
                    <span className={clsx('font-mono num text-[13.5px] font-medium', negative ? 'text-danger' : 'text-success')}>
                      {negative ? '−' : '+'}{fmtUSD(Math.abs(b.value))}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised dark:bg-raised-dark overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full transition-all', negative ? 'bg-danger/60' : 'bg-accent')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
            <li className="pt-3 border-t border-line dark:border-line-dark flex items-baseline justify-between">
              <span className="text-[13px] font-medium">Net monthly savings</span>
              <span className="font-mono num text-[16px] font-semibold">{fmtUSD(result.savingsMonthly)}</span>
            </li>
          </ul>
        </div>

        {/* Inputs recap */}
        <aside className="space-y-4">
          <div className="card p-5">
            <div className="stat-label mb-3">Inputs</div>
            <dl className="text-[12.5px] space-y-2.5">
              <Row k="Machine" v={machine.name} />
              <Row k="Processes" v={`${processes.length} selected`} />
              <Row k="Wafers / month" v={<span className="font-mono">{fmtNumber(result.input.wafersPerMonth)}</span>} />
              <Row k="Ops hours" v={<span className="font-mono">{result.input.hoursPerDay}h × {result.input.daysPerMonth}d</span>} />
            </dl>
            <div className="mt-4 pt-4 border-t border-line dark:border-line-dark">
              <div className="stat-label mb-2">Selected processes</div>
              <ul className="space-y-1 text-[12.5px]">
                {processes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="font-mono num text-faint dark:text-faint-dark text-[11px]">
                      {Math.round(p.optimizationFactor * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="card p-4 text-[11.5px] text-muted dark:text-muted-dark leading-relaxed">
            Estimate ID <span className="font-mono text-ink dark:text-ink-dark">EST-{Math.random().toString(36).slice(2, 8).toUpperCase()}</span>. Estimate bounds ±15%. Share this with your APAC rep to scope a pilot.
          </div>
          <button className="btn-accent w-full h-10">
            <CheckCircle2 size={14} /> Discuss this with Axiom
          </button>
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tracking-tightest num leading-none">{value}</div>
      {sub && <div className="mt-1 text-[11px] font-mono text-faint dark:text-faint-dark">{sub}</div>}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted dark:text-muted-dark">{k}</dt>
      <dd className="text-ink dark:text-ink-dark text-right">{v}</dd>
    </div>
  )
}

function ScoreDial({ score }: { score: number }) {
  const r = 64
  const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  const color = score >= 70 ? '#CCFF00' : score >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div className="relative flex items-center justify-center">
      <svg width={180} height={180} viewBox="0 0 180 180" className="-rotate-90">
        <circle cx={90} cy={90} r={r} fill="none" className="stroke-line dark:stroke-line-dark" strokeWidth={10} />
        <circle
          cx={90}
          cy={90}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[44px] font-semibold tracking-tightest num leading-none">{score}</div>
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted dark:text-muted-dark mt-1">
          / 100
        </div>
      </div>
    </div>
  )
}
