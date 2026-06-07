import { Badge } from './Badge'
import { DETECTION_LABEL, RISK_TIER_LABEL, RISK_TIER_TONE } from '../lib/constants'
import type { DetectionKey, IssueResult } from '../lib/types'

/**
 * Per-issue risk breakdown — severity / occurrence / detection / risk / band.
 * Shared by the live Calculator result and the AdminCalculatorRuns lead modal.
 * detectionLabel: optional override (Calculator passes its detectionOptions-aware
 * lookup so admin-renamed labels win; admin views default to the static map).
 */
export function RiskBreakdownTable({
  issues,
  detectionLabel,
}: {
  issues: IssueResult[]
  detectionLabel?: (k: DetectionKey | null | undefined) => string
}) {
  const labelOf = detectionLabel ?? ((k) => (k ? DETECTION_LABEL[k] ?? k : '—'))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted dark:text-muted-dark border-b border-line dark:border-line-dark">
            <th className="font-medium py-2 pr-2">Issue</th>
            <th className="font-medium py-2 px-2 text-right">Sev</th>
            <th className="font-medium py-2 px-2 text-right">Occ</th>
            <th className="font-medium py-2 px-2">Detection</th>
            <th className="font-medium py-2 px-2 text-right">Risk</th>
            <th className="font-medium py-2 pl-2">Band</th>
          </tr>
        </thead>
        <tbody className="divide-hair">
          {issues.map((it, idx) => (
            <tr key={it.issueId ?? idx}>
              <td className="py-2 pr-2">{it.label}</td>
              <td className="py-2 px-2 text-right num">{it.severity ? it.severity.toLocaleString() : '—'}</td>
              <td className="py-2 px-2 text-right num">{it.occurrence || '—'}</td>
              <td className="py-2 px-2 text-muted dark:text-muted-dark">{labelOf(it.detection)}</td>
              <td className="py-2 px-2 text-right num font-medium">{it.riskScore}</td>
              <td className="py-2 pl-2">
                {it.tier === 'none' ? (
                  <span className="text-faint">—</span>
                ) : (
                  <Badge tone={RISK_TIER_TONE[it.tier]}>{RISK_TIER_LABEL[it.tier]}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
