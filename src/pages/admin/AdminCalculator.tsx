import { useState } from 'react'
import { Plus, Save, Trash2, RotateCcw } from 'lucide-react'
import { load, save, uid } from '../../lib/storage'
import type { CalcConfig, Machine, Process } from '../../lib/types'
import { seedCalc } from '../../lib/seed'
import { fmtUSD } from '../../lib/format'

export default function AdminCalculator() {
  const [cfg, setCfg] = useState<CalcConfig>(() => load<CalcConfig>('calc', seedCalc))
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const change = (fn: (c: CalcConfig) => CalcConfig) => {
    setCfg((c) => fn(c))
    setDirty(true)
  }

  const persist = () => {
    save('calc', cfg)
    setDirty(false)
    setToast('Saved · partners will see updated logic on next estimate.')
    setTimeout(() => setToast(null), 2600)
  }
  const restore = () => {
    setCfg(seedCalc)
    setDirty(true)
  }

  const addMachine = () => {
    const id = uid('mch')
    const m: Machine = {
      id,
      name: 'New machine',
      family: 'Etch',
      node: 'All nodes',
      baselineCostPerWafer: 400,
      defaultThroughput: 100,
      params: [],
    }
    change((c) => ({ ...c, machines: [...c.machines, m] }))
  }

  const addProcess = () => {
    const id = uid('p')
    const p: Process = {
      id,
      name: 'New process',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.1,
      yieldUpliftPct: 1,
      compatibleMachines: [],
    }
    change((c) => ({ ...c, processes: [...c.processes, p] }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Calculator data model</h2>
          <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">
            Edit machines, processes, and global rates. Changes persist locally for this demo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-warn flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse-dot" /> unsaved
            </span>
          )}
          <button onClick={restore} className="btn-outline h-9 text-[12px]">
            <RotateCcw size={12} /> Restore defaults
          </button>
          <button onClick={persist} disabled={!dirty} className="btn-accent h-9 text-[12px] disabled:opacity-50">
            <Save size={12} /> Save changes
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 px-3 py-2 rounded-md text-[12.5px] bg-success/10 text-success border border-success/20 animate-fade-up">
          {toast}
        </div>
      )}

      {/* Globals */}
      <section className="card p-5 mb-5">
        <h3 className="text-[13px] font-medium mb-3">Global rates</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlobalField
            label="Wafer revenue"
            unit="$"
            value={cfg.globals.waferRevenue}
            onChange={(v) => change((c) => ({ ...c, globals: { ...c.globals, waferRevenue: v } }))}
          />
          <GlobalField
            label="Labor rate / hour"
            unit="$"
            value={cfg.globals.laborRatePerHour}
            onChange={(v) => change((c) => ({ ...c, globals: { ...c.globals, laborRatePerHour: v } }))}
          />
          <GlobalField
            label="Energy / kWh"
            unit="$"
            step={0.01}
            value={cfg.globals.energyCostPerKWh}
            onChange={(v) => change((c) => ({ ...c, globals: { ...c.globals, energyCostPerKWh: v } }))}
          />
          <GlobalField
            label="Service fee"
            unit="%"
            step={0.01}
            value={cfg.globals.serviceFeePct}
            onChange={(v) => change((c) => ({ ...c, globals: { ...c.globals, serviceFeePct: v } }))}
          />
        </div>
      </section>

      {/* Machines */}
      <section className="card mb-5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line dark:border-line-dark">
          <div>
            <h3 className="text-[13px] font-medium">Machines</h3>
            <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">{cfg.machines.length} total</div>
          </div>
          <button onClick={addMachine} className="btn-outline h-8 text-[12px]"><Plus size={12} /> Add machine</button>
        </div>
        <div className="divide-hair">
          {cfg.machines.map((m) => (
            <MachineRow
              key={m.id}
              m={m}
              onChange={(next) =>
                change((c) => ({
                  ...c,
                  machines: c.machines.map((mm) => (mm.id === m.id ? next : mm)),
                }))
              }
              onDelete={() =>
                change((c) => ({
                  ...c,
                  machines: c.machines.filter((mm) => mm.id !== m.id),
                  processes: c.processes.map((p) => ({
                    ...p,
                    compatibleMachines: p.compatibleMachines.filter((id) => id !== m.id),
                  })),
                }))
              }
            />
          ))}
        </div>
      </section>

      {/* Processes */}
      <section className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line dark:border-line-dark">
          <div>
            <h3 className="text-[13px] font-medium">Processes</h3>
            <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">{cfg.processes.length} total</div>
          </div>
          <button onClick={addProcess} className="btn-outline h-8 text-[12px]"><Plus size={12} /> Add process</button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th className="w-20">Steps</th>
              <th className="w-24">Complexity</th>
              <th className="w-28">Opt factor</th>
              <th className="w-24">Yield +</th>
              <th>Compatible with</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {cfg.processes.map((p) => (
              <ProcessRow
                key={p.id}
                p={p}
                machines={cfg.machines}
                onChange={(next) =>
                  change((c) => ({
                    ...c,
                    processes: c.processes.map((pp) => (pp.id === p.id ? next : pp)),
                  }))
                }
                onDelete={() => change((c) => ({ ...c, processes: c.processes.filter((pp) => pp.id !== p.id) }))}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function GlobalField({ label, unit, value, onChange, step = 1 }: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={step}
          className="input pr-9 font-mono num"
          value={value}
          onChange={(e) => onChange(+e.target.value || 0)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-faint dark:text-faint-dark">
          {unit}
        </span>
      </div>
    </div>
  )
}

function MachineRow({ m, onChange, onDelete }: { m: Machine; onChange: (m: Machine) => void; onDelete: () => void }) {
  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
      <div className="md:col-span-3">
        <label className="label">Name</label>
        <input className="input" value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <label className="label">Family</label>
        <select className="select" value={m.family} onChange={(e) => onChange({ ...m, family: e.target.value as Machine['family'] })}>
          {['Lithography', 'Etch', 'Deposition', 'Inspection', 'Metrology'].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Node</label>
        <input className="input" value={m.node} onChange={(e) => onChange({ ...m, node: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <label className="label">Baseline / wafer</label>
        <input type="number" className="input font-mono num" value={m.baselineCostPerWafer} onChange={(e) => onChange({ ...m, baselineCostPerWafer: +e.target.value || 0 })} />
        <div className="mt-1 text-[10px] font-mono text-faint dark:text-faint-dark">{fmtUSD(m.baselineCostPerWafer)}</div>
      </div>
      <div className="md:col-span-2">
        <label className="label">Throughput (w/hr)</label>
        <input type="number" className="input font-mono num" value={m.defaultThroughput} onChange={(e) => onChange({ ...m, defaultThroughput: +e.target.value || 0 })} />
      </div>
      <div className="md:col-span-1 flex items-end h-full">
        <button onClick={onDelete} className="btn-outline h-10 w-full text-danger border-danger/20 hover:bg-danger/5" aria-label="Delete machine">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function ProcessRow({ p, machines, onChange, onDelete }: { p: Process; machines: Machine[]; onChange: (p: Process) => void; onDelete: () => void }) {
  const toggleMachine = (id: string) => {
    const has = p.compatibleMachines.includes(id)
    onChange({ ...p, compatibleMachines: has ? p.compatibleMachines.filter((x) => x !== id) : [...p.compatibleMachines, id] })
  }
  return (
    <tr>
      <td>
        <input className="input h-8 text-[12.5px]" value={p.name} onChange={(e) => onChange({ ...p, name: e.target.value })} />
      </td>
      <td>
        <input type="number" className="input h-8 text-[12.5px] font-mono num" value={p.stepCount} onChange={(e) => onChange({ ...p, stepCount: +e.target.value || 0 })} />
      </td>
      <td>
        <input type="number" min={1} max={5} className="input h-8 text-[12.5px] font-mono num" value={p.complexity} onChange={(e) => onChange({ ...p, complexity: Math.max(1, Math.min(5, +e.target.value || 1)) as Process['complexity'] })} />
      </td>
      <td>
        <input type="number" step={0.01} min={0} max={0.5} className="input h-8 text-[12.5px] font-mono num" value={p.optimizationFactor} onChange={(e) => onChange({ ...p, optimizationFactor: +e.target.value || 0 })} />
      </td>
      <td>
        <input type="number" step={0.1} className="input h-8 text-[12.5px] font-mono num" value={p.yieldUpliftPct} onChange={(e) => onChange({ ...p, yieldUpliftPct: +e.target.value || 0 })} />
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {machines.map((m) => {
            const on = p.compatibleMachines.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggleMachine(m.id)} className={`text-[10.5px] px-1.5 py-0.5 rounded border transition ${
                on ? 'bg-accent border-accent text-accent-ink' : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
              }`}>
                {m.name}
              </button>
            )
          })}
        </div>
      </td>
      <td className="text-right">
        <button onClick={onDelete} className="text-faint dark:text-faint-dark hover:text-danger" aria-label="Delete">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  )
}
