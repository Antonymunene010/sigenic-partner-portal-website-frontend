import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Calculator as CalcIcon,
  CheckCircle2,
  Download,
  Factory,
  Layers,
  MessagesSquare,
  Printer,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import { load, nextTicketId, save, uid } from '../lib/storage'
import { makeSystemMsg, makeUserMsg, systemRouted } from '../lib/tickets'
import type { CalcConfig, CalcResult, CalcSelection, Machine, Process, Ticket } from '../lib/types'
import { seedCalc, seedTickets } from '../lib/seed'
import { calculate, defaultBusiness, defaultOperational } from '../lib/calculator'
import { useAuth } from '../lib/auth'
import { PageHeader } from '../components/PageHeader'
import { DescRow } from '../components/DescRow'
import { fmtNumber, fmtUSD } from '../lib/format'

const STEPS = [
  { id: 0, label: 'Context', icon: Factory },
  { id: 1, label: 'Processes', icon: Layers },
  { id: 2, label: 'Inputs', icon: Sliders },
  { id: 3, label: 'Machine tune', icon: Factory },
  { id: 4, label: 'Results', icon: Sparkles },
] as const

const LAST_STEP = STEPS.length - 1

export default function Calculator() {
  const [cfg] = useState(() => load<CalcConfig>('calc', seedCalc))
  const [step, setStep] = useState(0)

  const [fabId, setFabId] = useState<string>(cfg.fabs[0]?.id ?? '')
  const [departmentId, setDepartmentId] = useState<string>(cfg.departments[0]?.id ?? '')
  const [machineId, setMachineId] = useState<string>(() => {
    const dept = cfg.departments[0]
    return dept?.machineIds[0] ?? cfg.machines[0]?.id ?? ''
  })
  const [processIds, setProcessIds] = useState<string[]>([])

  const machine = cfg.machines.find((m) => m.id === machineId)
  const department = cfg.departments.find((d) => d.id === departmentId)

  const machinesInDept = useMemo(
    () =>
      department
        ? cfg.machines.filter((m) => department.machineIds.includes(m.id))
        : cfg.machines,
    [cfg.machines, department],
  )

  const compatibleProcesses = useMemo(
    () => cfg.processes.filter((p) => p.compatibleMachines.includes(machineId)),
    [cfg.processes, machineId],
  )

  const [operational, setOperational] = useState(defaultOperational)
  const [business, setBusiness] = useState(defaultBusiness)
  const [params, setParams] = useState<Record<string, number>>(() => {
    const m = cfg.machines.find((x) => x.id === machineId)
    return m ? Object.fromEntries(m.params.map((p) => [p.key, p.default])) : {}
  })

  const [result, setResult] = useState<CalcResult | null>(null)

  const reset = () => {
    setStep(0)
    setFabId(cfg.fabs[0]?.id ?? '')
    setDepartmentId(cfg.departments[0]?.id ?? '')
    setMachineId(cfg.departments[0]?.machineIds[0] ?? cfg.machines[0]?.id ?? '')
    setProcessIds([])
    setOperational(defaultOperational())
    setBusiness(defaultBusiness())
    const m = cfg.machines[0]
    setParams(m ? Object.fromEntries(m.params.map((p) => [p.key, p.default])) : {})
    setResult(null)
  }

  const changeDepartment = (id: string) => {
    setDepartmentId(id)
    const dept = cfg.departments.find((d) => d.id === id)
    const first = dept?.machineIds[0] ?? cfg.machines[0]?.id ?? ''
    changeMachine(first)
  }

  const changeMachine = (id: string) => {
    setMachineId(id)
    const compat = new Set(
      cfg.processes.filter((p) => p.compatibleMachines.includes(id)).map((p) => p.id),
    )
    setProcessIds((ps) => ps.filter((pid) => compat.has(pid)))
    const m = cfg.machines.find((mm) => mm.id === id)
    if (m) setParams(Object.fromEntries(m.params.map((p) => [p.key, p.default])))
  }

  const toggleProcess = (id: string) =>
    setProcessIds((xs) => (xs.includes(id) ? xs.filter((v) => v !== id) : [...xs, id]))

  const next = () => {
    if (step === 0 && (!fabId || !departmentId || !machineId)) return
    if (step === 1 && processIds.length === 0) return
    if (step === 3) {
      const sel: CalcSelection = { fabId, departmentId, machineId, processIds, params, operational, business }
      const r = calculate(cfg, sel)
      setResult(r)
      save('calc.latest', { savingsAnnual: r.annualSavings, score: r.score, at: new Date().toISOString() })
      setStep(LAST_STEP)
      return
    }
    setStep((s) => Math.min(LAST_STEP, s + 1))
  }
  const prev = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div>
      <PageHeader
        eyebrow="Score calculator · self-service ROI engine"
        title={
          <>
            Model your next <span className="font-serif italic font-normal">engagement</span>.
          </>
        }
        description="Pick a fab, department, machine and processes — then feed in your baseline yield, scrap, and downtime to estimate Sigenic-driven impact. Results can be turned into a tracked consultation request."
        actions={
          step === 4 && (
            <div className="flex gap-2">
              <button onClick={reset} className="btn-outline"><RotateCcw size={13} /> New estimate</button>
              <button onClick={() => window.print()} className="btn-outline"><Printer size={13} /> Print</button>
            </div>
          )
        }
      />

      <div className="card p-1 mb-6 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[640px]">
          {STEPS.map((s, i) => {
            const active = step === s.id
            const done = step > s.id
            return (
              <button
                key={s.id}
                onClick={() => (done ? setStep(s.id) : undefined)}
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

      {step === 0 && (
        <section className="animate-fade-up space-y-5">
          <div className="card p-5">
            <h2 className="text-[15px] font-semibold tracking-tight mb-4">Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label" htmlFor="fab">Fab / Site</label>
                <select id="fab" className="select" value={fabId} onChange={(e) => setFabId(e.target.value)}>
                  {cfg.fabs.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} · {f.location}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dept">Department</label>
                <select id="dept" className="select" value={departmentId} onChange={(e) => changeDepartment(e.target.value)}>
                  {cfg.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="machine">Machine / tool</label>
                <select id="machine" className="select" value={machineId} onChange={(e) => changeMachine(e.target.value)}>
                  {machinesInDept.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.node}</option>
                  ))}
                </select>
              </div>
            </div>
            {machine && (
              <div className="mt-5 pt-4 border-t border-line dark:border-line-dark grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Family" value={machine.family} />
                <MiniStat label="Baseline / wafer" value={fmtUSD(machine.baselineCostPerWafer)} />
                <MiniStat label="Throughput" value={`${machine.defaultThroughput} w/hr`} />
                <MiniStat label="Tunable params" value={String(machine.params.length)} />
              </div>
            )}
          </div>
        </section>
      )}

      {step === 1 && machine && (
        <section className="animate-fade-up">
          <h2 className="text-[15px] font-semibold tracking-tight mb-1">Select processes to optimize</h2>
          <p className="text-[12.5px] text-muted dark:text-muted-dark mb-4">
            Only processes compatible with <span className="font-mono text-ink dark:text-ink-dark">{machine.name}</span> are shown. Each process contributes differently to yield, scrap, and downtime.
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
                    <div className="mt-1 text-[11.5px] text-muted dark:text-muted-dark">
                      {p.stepCount} steps · complexity {p.complexity}/5
                    </div>
                  </div>
                  <span className={clsx(
                    'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                    processIds.includes(p.id) ? 'bg-accent border-accent' : 'border-line-strong dark:border-line-strong-dark',
                  )}>
                    {processIds.includes(p.id) && <CheckCircle2 size={13} className="text-accent-ink" strokeWidth={2.5} />}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                  <Pill label="Yield +" value={`${p.yieldUpliftPct.toFixed(1)}%`} />
                  <Pill label="Scrap −" value={`${p.scrapReductionPct.toFixed(1)}%`} />
                  <Pill label="Downtime −" value={`${p.downtimeReductionPct.toFixed(1)}%`} />
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

      {step === 2 && (
        <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="text-[14px] font-medium mb-1">Operational baseline</h3>
            <p className="text-[12px] text-muted dark:text-muted-dark mb-4">Current performance on this tool / process.</p>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Yield" unit="%" value={operational.yieldPct} set={(v) => setOperational((x) => ({ ...x, yieldPct: v }))} min={30} max={99.9} step={0.1} />
              <NumberField label="Defect rate" unit="%" value={operational.defectRate} set={(v) => setOperational((x) => ({ ...x, defectRate: v }))} min={0} max={20} step={0.1} />
              <NumberField label="Throughput" unit="w/hr" value={operational.throughput} set={(v) => setOperational((x) => ({ ...x, throughput: v }))} min={10} max={500} step={1} />
              <NumberField label="Scrap rate" unit="%" value={operational.scrapRate} set={(v) => setOperational((x) => ({ ...x, scrapRate: v }))} min={0} max={30} step={0.1} />
              <NumberField label="Downtime" unit="%" value={operational.downtimePct} set={(v) => setOperational((x) => ({ ...x, downtimePct: v }))} min={0} max={40} step={0.5} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-[14px] font-medium mb-1">Business baseline</h3>
            <p className="text-[12px] text-muted dark:text-muted-dark mb-4">Economics driving the impact calculation.</p>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Cost per wafer" unit="USD" value={business.costPerWafer} set={(v) => setBusiness((x) => ({ ...x, costPerWafer: v }))} min={50} max={5000} step={10} />
              <NumberField label="Volume / month" unit="wafers" value={business.volumePerMonth} set={(v) => setBusiness((x) => ({ ...x, volumePerMonth: v }))} min={100} max={200000} step={100} />
              <div className="col-span-2">
                <NumberField label="Cost of a single excursion" unit="USD" value={business.costOfExcursion} set={(v) => setBusiness((x) => ({ ...x, costOfExcursion: v }))} min={10000} max={10000000} step={10000} />
                <p className="mt-1.5 text-[11px] text-faint dark:text-faint-dark leading-snug">
                  Typical in-fab excursion (scrap + investigation + opportunity cost). Used for excursion-avoidance modeling.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {step === 3 && machine && (
        <section className="animate-fade-up grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Factory size={14} className="text-muted dark:text-muted-dark" />
              <h3 className="text-[14px] font-medium">{machine.name} parameters</h3>
            </div>
            <div className="space-y-5">
              {machine.params.map((p) => {
                const val = params[p.key] ?? p.default
                const inputId = `param-${p.key}`
                return (
                  <div key={p.key}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label htmlFor={inputId} className="label mb-0">{p.label}</label>
                      <span className="font-mono num text-[13px]">
                        {fmtNumber(val, p.step < 1 ? 1 : 0)} <span className="text-faint dark:text-faint-dark">{p.unit}</span>
                      </span>
                    </div>
                    <input
                      id={inputId}
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={val}
                      aria-valuetext={`${val} ${p.unit}`}
                      onChange={(e) => setParams((x) => ({ ...x, [p.key]: +e.target.value }))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-faint dark:text-faint-dark mt-1">
                      <span>{p.min}{p.unit}</span>
                      <span>default {p.default}{p.unit}</span>
                      <span>{p.max}{p.unit}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="stat-label mb-3">Ready to calculate</div>
              <dl className="text-[12.5px] space-y-2">
                <DescRow k="Fab" v={cfg.fabs.find((f) => f.id === fabId)?.name ?? '—'} />
                <DescRow k="Dept" v={department?.name ?? '—'} />
                <DescRow k="Machine" v={machine.name} />
                <DescRow k="Processes" v={`${processIds.length} selected`} />
                <DescRow k="Volume" v={<span className="font-mono">{fmtNumber(business.volumePerMonth)} /mo</span>} />
              </dl>
            </div>
            <div className="card p-4 text-[11.5px] text-muted dark:text-muted-dark leading-relaxed">
              <strong className="text-ink dark:text-ink-dark font-medium">Rule-based MVP.</strong> Outputs are bounded estimates. See the calculator SOP for how each lever contributes.
            </div>
          </aside>
        </section>
      )}

      {step === 4 && result && machine && (
        <ResultView
          cfg={cfg}
          result={result}
          machine={machine}
          processes={cfg.processes.filter((p) => processIds.includes(p.id))}
        />
      )}

      {step < 4 && (
        <div className="mt-6 flex items-center justify-between">
          <button onClick={prev} disabled={step === 0} className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowLeft size={13} /> Back
          </button>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark">
            Step {step + 1} of {STEPS.length}
          </div>
          <button
            onClick={next}
            disabled={(step === 0 && !machineId) || (step === 1 && processIds.length === 0)}
            className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 3 ? (<><CalcIcon size={13} /> Calculate</>) : (<>Continue <ArrowRight size={13} /></>)}
          </button>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-faint dark:text-faint-dark font-mono">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-mono num">{value}</div>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-faint dark:text-faint-dark font-mono uppercase tracking-[0.1em] text-[9.5px]">{label}</span>
      <span className="font-mono num font-medium text-ink dark:text-ink-dark">{value}</span>
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
          className="input pr-16 font-mono num"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
          {unit}
        </span>
      </div>
    </div>
  )
}

function ResultView({
  cfg,
  result,
  machine,
  processes,
}: {
  cfg: CalcConfig
  result: CalcResult
  machine: Machine
  processes: Process[]
}) {
  const { user } = useAuth()
  const nav = useNavigate()
  const scoreColor = result.score >= 70 ? 'text-success' : result.score >= 40 ? 'text-warn' : 'text-danger'
  const maxAbs = Math.max(...result.breakdown.map((b) => Math.abs(b.value)))
  const estimateId = useMemo(() => uid('EST'), [result])

  const fab = cfg.fabs.find((f) => f.id === result.input.fabId)
  const dept = cfg.departments.find((d) => d.id === result.input.departmentId)

  const exportReport = () => {
    const report = {
      estimateId,
      generatedAt: new Date().toISOString(),
      context: {
        fab: fab?.name,
        department: dept?.name,
        machine: machine.name,
        processes: processes.map((p) => p.name),
      },
      operational: result.input.operational,
      business: result.input.business,
      params: result.input.params,
      output: {
        yieldImprovementPct: result.yieldImprovementPct,
        scrapReductionPct: result.scrapReductionPct,
        downtimeReductionPct: result.downtimeReductionPct,
        monthlySavings: result.monthlySavings,
        annualSavings: result.annualSavings,
        paybackMonths: result.paybackMonths,
        fasterDetectionHrs: result.fasterDetectionHrs,
        manualEffortReductionHrs: result.manualEffortReductionHrs,
        score: result.score,
        breakdown: result.breakdown,
      },
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${estimateId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const requestConsultation = () => {
    const tickets = load<Ticket[]>('tickets', seedTickets)
    const id = nextTicketId()
    const now = new Date().toISOString()
    const body = [
      `Requesting a consultation based on calculator estimate ${estimateId}.`,
      '',
      `Fab: ${fab?.name}`,
      `Department: ${dept?.name}`,
      `Machine: ${machine.name}`,
      `Processes: ${processes.map((p) => p.name).join(', ')}`,
      '',
      `Baseline yield: ${result.input.operational.yieldPct}%`,
      `Scrap rate: ${result.input.operational.scrapRate}%`,
      `Downtime: ${result.input.operational.downtimePct}%`,
      `Volume: ${fmtNumber(result.input.business.volumePerMonth)} wafers/month`,
      `Cost per wafer: ${fmtUSD(result.input.business.costPerWafer)}`,
      '',
      `Estimated annual savings: ${fmtUSD(result.annualSavings)}`,
      `Score: ${result.score}/100`,
      `Payback: ${result.paybackMonths.toFixed(1)} months`,
    ].join('\n')
    const ticket: Ticket = {
      id,
      subject: `Consultation request · ${machine.name} · ${dept?.name}`,
      status: 'open',
      priority: 'normal',
      category: 'consulting',
      productArea: (machine.family as Ticket['productArea']) ?? 'Other',
      customerImpact: 'medium',
      requester: user?.name ?? 'You',
      tags: ['calculator', 'consultation', estimateId.toLowerCase()],
      createdAt: now,
      updatedAt: now,
      source: 'calculator',
      messages: [
        makeUserMsg(user?.name ?? 'You', body, now),
        makeSystemMsg(`Estimate ${estimateId} attached. ${systemRouted('APAC · consulting')}`, now),
      ],
    }
    save('tickets', [ticket, ...tickets])
    nav(`/app/support/${id}`)
  }

  return (
    <div className="animate-fade-up">
      <div className="card-raised overflow-hidden relative mb-5">
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="md:col-span-2 p-8 border-b md:border-b-0 md:border-r border-line dark:border-line-dark">
            <div className="eyebrow mb-3">Estimated outcome</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-[56px] md:text-[72px] font-semibold tracking-tightest num leading-none text-ink dark:text-ink-dark">
                {fmtUSD(result.annualSavings)}
              </div>
              <div className="text-[13px] font-mono uppercase tracking-[0.12em] text-muted dark:text-muted-dark">
                net savings / year
              </div>
            </div>
            <div className="mt-2 text-[14px] text-muted dark:text-muted-dark">
              {fmtUSD(result.monthlySavings)} / month · payback {result.paybackMonths.toFixed(1)} months
            </div>

            <div className="mt-7 grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Yield improvement" value={`+${result.yieldImprovementPct.toFixed(1)}%`} />
              <Stat label="Scrap reduction" value={`−${result.scrapReductionPct.toFixed(1)}%`} />
              <Stat label="Downtime reduction" value={`−${result.downtimeReductionPct.toFixed(1)}%`} />
              <Stat label="Faster detection" value={`${result.fasterDetectionHrs} hrs`} sub="per excursion" />
              <Stat label="Manual effort saved" value={`${result.manualEffortReductionHrs} hrs`} sub="per month" />
              <Stat label="Estimate ID" value={estimateId} sub={`± 15% bounds`} />
            </div>
          </div>

          <div className="p-8 relative">
            <div className="eyebrow mb-3">Sigenic Score</div>
            <ScoreDial score={result.score} />
            <div className={clsx('text-center mt-3 text-[12px] font-medium', scoreColor)}>
              {result.score >= 70 ? 'Strong fit · fast payback' : result.score >= 40 ? 'Solid · consider pilot' : 'Marginal · re-scope'}
            </div>
            <div className="text-center text-[11px] text-muted dark:text-muted-dark mt-1 leading-relaxed">
              Composite of savings, yield, scrap, downtime, and payback.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-[14px] font-medium mb-4">Financial breakdown · monthly</h3>
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
              <span className="font-mono num text-[16px] font-semibold">{fmtUSD(result.monthlySavings)}</span>
            </li>
          </ul>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="stat-label mb-3">Inputs</div>
            <dl className="text-[12.5px] space-y-2.5">
              <DescRow k="Fab" v={fab?.name ?? '—'} />
              <DescRow k="Dept" v={dept?.name ?? '—'} />
              <DescRow k="Machine" v={machine.name} />
              <DescRow k="Processes" v={`${processes.length} selected`} />
              <DescRow k="Yield baseline" v={<span className="font-mono">{result.input.operational.yieldPct}%</span>} />
              <DescRow k="Scrap" v={<span className="font-mono">{result.input.operational.scrapRate}%</span>} />
              <DescRow k="Downtime" v={<span className="font-mono">{result.input.operational.downtimePct}%</span>} />
              <DescRow k="Volume" v={<span className="font-mono">{fmtNumber(result.input.business.volumePerMonth)} /mo</span>} />
              <DescRow k="Excursion $" v={<span className="font-mono">{fmtUSD(result.input.business.costOfExcursion)}</span>} />
            </dl>
          </div>

          <button onClick={requestConsultation} className="btn-accent w-full h-10">
            <MessagesSquare size={14} /> Request consultation
          </button>
          <button onClick={exportReport} className="btn-outline w-full h-9 text-[12.5px]">
            <Download size={13} /> Export report · JSON
          </button>
          <div className="card p-4 text-[11.5px] text-muted dark:text-muted-dark leading-relaxed">
            "Request consultation" creates a Sigenic ticket with this estimate attached.
          </div>
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
