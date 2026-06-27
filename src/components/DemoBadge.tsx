import type { ReactNode } from 'react'
import { Badge } from './Badge'
import { isDemoEmail } from '../../shared/demo'

// With `children`: wraps them in an inline-flex span and appends the chip
// (real accounts pass through unchanged). Without: renders just the chip,
// or null when the email isn't a demo one.
const TITLE = 'Seeded demo account — not a real customer user.'

export function DemoBadge({ email, children }: { email: string | null | undefined; children?: ReactNode }) {
  const isDemo = isDemoEmail(email)
  if (!isDemo) return children ? <>{children}</> : null
  const chip = <Badge tone="neutral">DEMO</Badge>
  if (!children) return <span title={TITLE}>{chip}</span>
  return (
    <span title={TITLE} className="inline-flex items-center gap-2">
      {children}
      {chip}
    </span>
  )
}
