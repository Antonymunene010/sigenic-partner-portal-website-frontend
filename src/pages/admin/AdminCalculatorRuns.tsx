import { useMemo, useState } from 'react'
import { Calculator, TrendingUp, Flame, Users } from 'lucide-react'
import { useData, useLookups } from '../../lib/data'
import { PageHeader } from '../../components/PageHeader'
import { DataTable, type Column } from '../../components/DataTable'
import { Badge } from '../../components/Badge'
import { Modal } from '../../components/Modal'
import { MultiSelect } from '../../components/MultiSelect'
import { DescRow } from '../../components/DescRow'
import { RiskBreakdownTable } from '../../components/RiskBreakdownTable'
import { StatCard, Spinner } from '../../components/ui'
import { fmtRelative, fmtUSD, fmtDateTime, fmtNumber } from '../../lib/format'
import { RISK_TIERS, RISK_TIER_TONE, RISK_TIER_LABEL, type Tone } from '../../lib/constants'
import type { CalculatorRun, RiskTier } from '../../lib/types'

type RunType = CalculatorRun['runType']

const RUN_TYPES: { value: RunType; label: string; tone: Tone }[] = [
  { value: 'partner', label: 'Customer', tone: 'success' },
  { value: 'distributor', label: 'Distributor', tone: 'info' },
  { value: 'internal', label: 'Internal', tone: 'neutral' },
  { value: 'public', label: 'Anonymous (public)', tone: 'warn' },
]

const RUN_TYPE_LABEL: Record<RunType, string> = Object.fromEntries(
  RUN_TYPES.map((r) => [r.value, r.label]),
) as Record<RunType, string>
const RUN_TYPE_TONE: Record<RunType, Tone> = Object.fromEntries(
  RUN_TYPES.map((r) => [r.value, r.tone]),
) as Record<RunType, Tone>

// Risk-band filter options — drop the 'none' tier (no UI meaning).
const TIER_OPTIONS = RISK_TIERS.filter((t) => t.value !== 'none').map((t) => ({ value: t.value, label: t.label }))

export default function AdminCalculatorRuns() {
  const { calculatorRuns, ready } = useData()
  const { companyName, userName, departmentName, machineName } = useLookups()
  const [runTypes, setRunTypes] = useState<RunType[]>(['partner', 'distributor'])
  const [tiers, setTiers] = useState<RiskTier[]>([])
  const [selected, setSelected] = useState<CalculatorRun | null>(null)

  // Leads = external runs (a known external user the team can follow up with).
  // Computed independently of the UI filters so the stat cards stay stable.
  const leads = useMemo(
    () => calculatorRuns.filter((r) => r.runType === 'partner' || r.runType === 'distributor'),
    [calculatorRuns],
  )
  const highRisk = leads.filter((r) => r.overallTier === 'high')
  const totalOpportunity = leads.reduce((sum, r) => sum + (r.totalAnnualValueLoss ?? 0), 0)
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentCount = calculatorRuns.filter((r) => new Date(r.createdAt).getTime() >= recentCutoff).length

  const rows = useMemo(
    () =>
      calculatorRuns.filter(
        (r) =>
          (runTypes.length === 0 || runTypes.includes(r.runType)) &&
          (tiers.length === 0 || (r.overallTier && tiers.includes(r.overallTier))),
      ),
    [calculatorRuns, runTypes, tiers],
  )

  if (!ready) return <Spinner />

  const columns: Column<CalculatorRun>[] = [
    {
      key: 'contact',
      header: 'Lead',
      sortAccessor: (r) => companyName(r.companyId).toLowerCase(),
      render: (r) =>
        r.runType === 'public' ? (
          <div className="min-w-0">
            <div className="font-medium text-faint dark:text-faint-dark">Anonymous</div>
            <div className="text-xs text-muted dark:text-muted-dark">Public landing-page calc</div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="font-medium truncate">{userName(r.userId)}</div>
            <div className="text-xs text-muted dark:text-muted-dark truncate">{companyName(r.companyId)}</div>
          </div>
        ),
    },
    {
      key: 'type',
      header: 'Type',
      sortAccessor: (r) => r.runType,
      render: (r) => <Badge tone={RUN_TYPE_TONE[r.runType]}>{RUN_TYPE_LABEL[r.runType]}</Badge>,
    },
    {
      key: 'scope',
      header: 'Department / machine',
      sortAccessor: (r) => departmentName(r.departmentId).toLowerCase(),
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate">{departmentName(r.departmentId)}</div>
          {r.machineId && (
            <div className="text-xs text-muted dark:text-muted-dark truncate">{machineName(r.machineId)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      className: 'text-right',
      sortAccessor: (r) => r.overallRiskScore ?? -1,
      render: (r) =>
        r.overallTier && r.overallTier !== 'none' ? (
          <div className="flex items-center justify-end gap-2">
            <span className="num font-medium">{r.overallRiskScore ?? '—'}</span>
            <Badge tone={RISK_TIER_TONE[r.overallTier]}>{RISK_TIER_LABEL[r.overallTier]}</Badge>
          </div>
        ) : (
          <span className="text-faint dark:text-faint-dark">—</span>
        ),
    },
    {
      key: 'loss',
      header: 'Annual yield loss',
      className: 'text-right',
      sortAccessor: (r) => r.totalAnnualValueLoss ?? -1,
      render: (r) =>
        r.totalAnnualValueLoss != null ? (
          <span className="num">{fmtUSD(r.totalAnnualValueLoss)}</span>
        ) : (
          <span className="text-faint dark:text-faint-dark">—</span>
        ),
    },
    {
      key: 'when',
      header: 'When',
      className: 'text-right',
      sortAccessor: (r) => r.createdAt,
      render: (r) => <span className="text-xs text-faint dark:text-faint-dark">{fmtRelative(r.createdAt)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Sales pipeline"
        title="Calculator leads"
        description="Every time a partner runs the risk calculator we log it here — risk band and yield-loss opportunity are the conversation starters for follow-up."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="External leads" value={leads.length} sub="customer + distributor" icon={<Users size={15} />} />
        <StatCard
          label="High-risk leads"
          value={highRisk.length}
          sub="prioritise these"
          icon={<Flame size={15} />}
          accent={highRisk.length > 0}
        />
        <StatCard
          label="Opportunity at stake"
          value={fmtUSD(totalOpportunity)}
          sub="sum of annual yield loss"
          icon={<TrendingUp size={15} />}
          accent={totalOpportunity > 0}
        />
        <StatCard label="Runs in last 7 days" value={recentCount} sub={`${calculatorRuns.length} total`} icon={<Calculator size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MultiSelect label="All types" options={RUN_TYPES} selected={runTypes} onChange={setRunTypes} />
        <MultiSelect label="Any risk band" options={TIER_OPTIONS} selected={tiers} onChange={setTiers} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => setSelected(r)}
        empty="No calculator runs match these filters."
        defaultSort={{ key: 'when', dir: 'desc' }}
      />

      <RunDetailModal run={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function RunDetailModal({ run, onClose }: { run: CalculatorRun | null; onClose: () => void }) {
  const { companyName, userName, departmentName, machineName, siteName, scoringModelName } = useLookups()
  if (!run) return null
  const output = run.outputSummaryJson

  return (
    <Modal
      open={!!run}
      onClose={onClose}
      wide
      title={
        <div className="flex items-center gap-2">
          <span>Calculator run</span>
          <Badge tone={RUN_TYPE_TONE[run.runType]}>{RUN_TYPE_LABEL[run.runType]}</Badge>
        </div>
      }
    >
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
        <DescRow k="Lead" v={run.runType === 'public' ? 'Anonymous (public calc)' : userName(run.userId)} />
        <DescRow k="Company" v={run.runType === 'public' ? '—' : companyName(run.companyId)} />
        <DescRow k="Department" v={departmentName(run.departmentId)} />
        <DescRow k="Machine" v={run.machineId ? machineName(run.machineId) : '—'} />
        <DescRow k="Site" v={run.siteId ? siteName(run.siteId) : '—'} />
        <DescRow k="Technology" v={run.technology ?? '—'} />
        <DescRow k="Scoring model" v={scoringModelName(run.scoringModelId)} />
        <DescRow k="Run at" v={fmtDateTime(run.createdAt)} />
      </dl>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard
          label="Overall risk"
          value={run.overallRiskScore != null ? `${run.overallRiskScore} / 15` : '—'}
          sub={run.overallTier && run.overallTier !== 'none' ? <Badge tone={RISK_TIER_TONE[run.overallTier]}>{RISK_TIER_LABEL[run.overallTier]}</Badge> : null}
          accent
        />
        <StatCard
          label="Annual yield loss"
          value={run.totalAnnualValueLoss != null ? fmtUSD(run.totalAnnualValueLoss) : '—'}
          sub="savings opportunity"
          accent
        />
        <StatCard
          label="Wafers at risk / yr"
          value={run.totalAnnualWaferLoss != null ? fmtNumber(run.totalAnnualWaferLoss) : '—'}
        />
      </div>

      {output?.issues && output.issues.length > 0 ? (
        <RiskBreakdownTable issues={output.issues} />
      ) : (
        <p className="text-sm text-muted dark:text-muted-dark">No per-issue breakdown captured for this run.</p>
      )}
    </Modal>
  )
}
