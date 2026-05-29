import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Tone } from '../lib/constants'

const TONES: Record<Tone, string> = {
  neutral: 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised dark:bg-raised-dark',
  accent: 'border-accent-dim text-accent-ink bg-accent',
  success: 'border-success/30 text-success bg-success/5',
  warn: 'border-warn/30 text-warn bg-warn/5',
  danger: 'border-danger/30 text-danger bg-danger/5',
  info: 'border-info/30 text-info bg-info/5',
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-faint',
  accent: 'bg-accent-ink',
  success: 'bg-success',
  warn: 'bg-warn animate-pulse-dot',
  danger: 'bg-danger animate-pulse-dot',
  info: 'bg-info animate-pulse-dot',
}

export function Badge({ tone = 'neutral', children, dot = false }: { tone?: Tone; children?: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx('badge', TONES[tone])}>
      {dot && <span aria-hidden className={clsx('inline-block w-1.5 h-1.5 rounded-full -ml-0.5', DOT[tone])} />}
      {children}
    </span>
  )
}
