import { Badge } from './Badge'
import { RiskBreakdownTable } from './RiskBreakdownTable'
import { StatCard } from './ui'
import type { Column } from './DataTable'
import { fmtRelative, fmtUSD, fmtNumber } from '../lib/format'
import { RISK_TIER_TONE, RISK_TIER_LABEL } from '../lib/constants'
import type { useLookups } from '../lib/data'
import type { CalculatorRun } from '../lib/types'

// Shared widths for the risk column's two aligned slots — kept in one place so the
// header spacer and the cell stay in lockstep. The tier slot is a min-width floor.
const RISK_SCORE_SLOT = 'w-9'
const RISK_TIER_SLOT = 'min-w-[6.25rem]'

/**
 * The run-table columns shared by every calculator-run list (internal "Calculator
 * leads" + external "Calculator history"): department/machine, risk band, annual
 * yield loss, recency. Pages prepend their own identity columns.
 */
export function runColumns({
  departmentName,
  machineName,
}: Pick<ReturnType<typeof useLookups>, 'departmentName' | 'machineName'>): Column<CalculatorRun>[] {
  return [
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
      // Score and tier badge each get their own slot so that, row over row, the numbers
      // align on their right edge (fixed narrow slot + tabular-nums) and the tier labels
      // align on their left edge. The badge slot is a min-width, not a fixed width, so a
      // longer label (new tier / renamed / translated) grows the slot instead of overflowing.
      header: <span className="inline-flex items-center"><span className={`${RISK_SCORE_SLOT} text-right`}>Risk</span><span className={RISK_TIER_SLOT} /></span>,
      className: 'text-right',
      sortAccessor: (r) => r.overallRiskScore ?? -1,
      render: (r) =>
        r.overallTier && r.overallTier !== 'none' ? (
          <div className="inline-flex items-center gap-2">
            <span className={`num font-medium text-right tabular-nums ${RISK_SCORE_SLOT}`}>{r.overallRiskScore ?? '—'}</span>
            <span className={`text-left ${RISK_TIER_SLOT}`}>
              <Badge tone={RISK_TIER_TONE[r.overallTier]}>{RISK_TIER_LABEL[r.overallTier]}</Badge>
            </span>
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
}

/**
 * Result section of a stored calculator run — headline stats, per-issue
 * breakdown and the submitter's free-text notes. Shared by the internal
 * "Calculator leads" modal and the external "Calculator history" page.
 */
export function RunResultSummary({ run }: { run: CalculatorRun }) {
  const output = run.outputSummaryJson
  return (
    <>
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

      {(run.preventiveMeasures || run.costsIncurred) && (
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          {run.preventiveMeasures && (
            <div className="rounded-md border border-line dark:border-line-dark p-3">
              <div className="stat-label mb-1">Preventive measures already implemented</div>
              <p className="text-sm whitespace-pre-wrap">{run.preventiveMeasures}</p>
            </div>
          )}
          {run.costsIncurred && (
            <div className="rounded-md border border-line dark:border-line-dark p-3">
              <div className="stat-label mb-1">Associated costs incurred</div>
              <p className="text-sm whitespace-pre-wrap">{run.costsIncurred}</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
