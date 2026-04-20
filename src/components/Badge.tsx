import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Invoice, TicketPriority, TicketStatus } from '../lib/types'

type Tone = TicketStatus | TicketPriority | Invoice['status'] | 'neutral' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised dark:bg-raised-dark',
  open: 'border-info/30 text-info bg-info/5',
  pending: 'border-warn/30 text-warn bg-warn/5',
  solved: 'border-success/30 text-success bg-success/5',
  closed: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised/60 dark:bg-raised-dark/60',
  urgent: 'border-danger/30 text-danger bg-danger/5',
  high: 'border-warn/30 text-warn bg-warn/5',
  normal: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised/60 dark:bg-raised-dark/60',
  low: 'border-line dark:border-line-dark text-faint dark:text-faint-dark bg-transparent',
  accent: 'border-accent-dim text-accent-ink bg-accent',
  paid: 'border-success/30 text-success bg-success/5',
  overdue: 'border-danger/30 text-danger bg-danger/5',
}

const DOT: Partial<Record<Tone, string>> = {
  open: 'bg-info animate-pulse-dot',
  pending: 'bg-warn',
  solved: 'bg-success',
  urgent: 'bg-danger animate-pulse-dot',
  high: 'bg-warn',
  closed: 'bg-faint',
  paid: 'bg-success',
  overdue: 'bg-danger',
  accent: 'bg-accent-ink',
}

export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: Tone
  children: ReactNode
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
      {children}
    </span>
  )
}
