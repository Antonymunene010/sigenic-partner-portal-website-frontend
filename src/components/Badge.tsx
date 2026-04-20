import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { CustomerImpact, Invoice, TicketPriority, TicketStatus } from '../lib/types'

type Tone =
  | TicketStatus
  | TicketPriority
  | Invoice['status']
  | CustomerImpact
  | 'neutral'
  | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised dark:bg-raised-dark',
  open: 'border-info/30 text-info bg-info/5',
  in_progress: 'border-warn/30 text-warn bg-warn/5',
  resolved: 'border-success/30 text-success bg-success/5',
  closed: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised/60 dark:bg-raised-dark/60',
  urgent: 'border-danger/30 text-danger bg-danger/5',
  high: 'border-warn/30 text-warn bg-warn/5',
  normal: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised/60 dark:bg-raised-dark/60',
  low: 'border-line dark:border-line-dark text-faint dark:text-faint-dark bg-transparent',
  accent: 'border-accent-dim text-accent-ink bg-accent',
  paid: 'border-success/30 text-success bg-success/5',
  overdue: 'border-danger/30 text-danger bg-danger/5',
  critical: 'border-danger/30 text-danger bg-danger/5',
  medium: 'border-warn/30 text-warn bg-warn/5',
}

const DOT: Partial<Record<Tone, string>> = {
  open: 'bg-info animate-pulse-dot',
  in_progress: 'bg-warn animate-pulse-dot',
  resolved: 'bg-success',
  urgent: 'bg-danger animate-pulse-dot',
  high: 'bg-warn',
  closed: 'bg-faint',
  paid: 'bg-success',
  overdue: 'bg-danger',
  accent: 'bg-accent-ink',
  critical: 'bg-danger animate-pulse-dot',
  medium: 'bg-warn',
}

const LABELS: Partial<Record<Tone, string>> = {
  open: 'open',
  in_progress: 'in progress',
  resolved: 'resolved',
  closed: 'closed',
  urgent: 'urgent',
  high: 'high',
  normal: 'normal',
  low: 'low',
  critical: 'critical',
  medium: 'medium',
  paid: 'paid',
  overdue: 'overdue',
  neutral: '',
  accent: '',
}

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: Tone
  children?: ReactNode
  dot?: boolean
}) {
  return (
    <span className={clsx('badge', TONES[tone])}>
      {dot && (
        <span
          aria-hidden
          className={clsx('inline-block w-1.5 h-1.5 rounded-full -ml-0.5', DOT[tone] ?? 'bg-muted')}
        />
      )}
      {children ?? LABELS[tone] ?? tone}
    </span>
  )
}
