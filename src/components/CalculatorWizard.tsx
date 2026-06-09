import { CheckCircle2, RotateCcw } from 'lucide-react'
import { type ReactNode } from 'react'
import { Card } from './ui'
import { Badge } from './Badge'
import { RISK_TIERS, RISK_TIER_GUIDANCE, RISK_TIER_LABEL, RISK_TIER_TONE } from '../lib/constants'
import { fmtDateTime, fmtUSD } from '../lib/format'
import type { RiskTier } from '../lib/types'

/**
 * Shared widgets for the risk-calculator wizard (src/pages/Calculator.tsx):
 * step navigation, tier guidance, and the post-submit confirmation card. Kept
 * as standalone pieces so the page file stays focused on form state.
 */

export type WizardStep = 0 | 1 | 2

const STEP_LABELS = ['Basic information', 'Statistical analysis', 'Additional information'] as const

export function Stepper({ step }: { step: WizardStep }) {
  return (
    <div className="mb-5 flex items-center gap-2 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const active = i === step
        const done = i < step
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={
                'inline-flex items-center gap-2 px-3 h-8 rounded-md text-sm font-medium ' +
                (active
                  ? 'bg-accent/15 text-emphasis'
                  : done
                  ? 'text-emphasis'
                  : 'text-muted dark:text-muted-dark')
              }
            >
              <span
                className={
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ' +
                  (active || done ? 'bg-accent text-accent-ink' : 'bg-raised dark:bg-raised-dark')
                }
              >
                {done ? '✓' : i + 1}
              </span>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <span className="text-faint dark:text-faint-dark">›</span>}
          </div>
        )
      })}
    </div>
  )
}

export function WizardFooter({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-6 pt-4 border-t border-line dark:border-line-dark flex flex-wrap items-center justify-between gap-2">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

export function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button className="btn-ghost" onClick={onReset} type="button">
      <RotateCcw size={14} /> Reset
    </button>
  )
}

/** The three High/Medium/Low recommendation cards shown on Step 2 — identical across both wizards. */
export function TierGuidanceCards() {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {(['high', 'medium', 'low'] as const).map((t) => (
        <div key={t} className="rounded-md border border-line dark:border-line-dark p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <Badge tone={RISK_TIER_TONE[t]}>{RISK_TIER_LABEL[t]}</Badge>
            <span className="text-xs text-muted dark:text-muted-dark">
              {RISK_TIERS.find((x) => x.value === t)?.range}
            </span>
          </div>
          <p className="text-muted dark:text-muted-dark">{RISK_TIER_GUIDANCE[t]}</p>
        </div>
      ))}
    </div>
  )
}

/** Post-submit confirmation card. Public flow passes a "Partner sign in →" link as `extra`. */
export function Confirmation({
  runId,
  submittedAt,
  overallRiskScore,
  overallTier,
  totalAnnualValueLoss,
  onReset,
  extra,
}: {
  runId: string
  submittedAt: string
  overallRiskScore: number
  overallTier: RiskTier
  totalAnnualValueLoss: number
  onReset: () => void
  extra?: ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-success mt-0.5">
          <CheckCircle2 size={22} />
        </span>
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Submission received</h2>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Your assessment has been logged and the Sigenic team has been notified by email. They will follow up shortly.
          </p>
          <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted dark:text-muted-dark">Documentation</dt>
              <dd className="font-mono">{runId}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-muted-dark">Submitted at</dt>
              <dd>{fmtDateTime(submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-muted-dark">Overall risk</dt>
              <dd>
                {overallRiskScore} / 15 ·{' '}
                <Badge tone={RISK_TIER_TONE[overallTier]}>{RISK_TIER_LABEL[overallTier]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted dark:text-muted-dark">Annual yield-loss exposure</dt>
              <dd>{fmtUSD(totalAnnualValueLoss)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-outline" onClick={onReset}>
              <RotateCcw size={14} /> Start a new assessment
            </button>
            {extra}
          </div>
        </div>
      </div>
    </Card>
  )
}
