import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'open' | 'pending' | 'solved' | 'closed' | 'urgent' | 'high' | 'normal' | 'low' | 'accent' | 'paid' | 'overdue'

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

export function Badge({ tone = 'neutral', children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx('badge', TONES[tone])}>
      {dot && (
        <span
          className={clsx(
            'inline-block w-1.5 h-1.5 rounded-full -ml-0.5',
            tone === 'open' && 'bg-info animate-pulse-dot',
            tone === 'pending' && 'bg-warn',
            tone === 'solved' && 'bg-success',
            tone === 'urgent' && 'bg-danger animate-pulse-dot',
            tone === 'high' && 'bg-warn',
            tone === 'closed' && 'bg-faint',
            tone === 'paid' && 'bg-success',
            tone === 'overdue' && 'bg-danger',
            tone === 'accent' && 'bg-accent-ink',
            !['open', 'pending', 'solved', 'urgent', 'high', 'closed', 'paid', 'overdue', 'accent'].includes(tone) && 'bg-muted',
          )}
        />
      )}
      {children}
    </span>
  )
}
