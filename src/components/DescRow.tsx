import type { ReactNode } from 'react'

export function DescRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted dark:text-muted-dark">{k}</dt>
      <dd className="text-ink dark:text-ink-dark text-right">{v}</dd>
    </div>
  )
}
