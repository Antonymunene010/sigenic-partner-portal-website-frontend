import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { partnerAllows, partnerStatusLabel } from '../lib/permissions'
import type { PermissionKey } from '../lib/types'

const FEATURE_LABEL: Record<PermissionKey, string> = {
  calculator: 'Score Calculator',
  case_studies: 'Success Stories',
  service_requests: 'Service Requests',
  billing: 'Billing',
  zendesk: 'Support',
}

export function FeatureGate({ feature, children }: { feature: PermissionKey; children: ReactNode }) {
  const { user } = useAuth()
  if (partnerAllows(user, feature)) return <>{children}</>

  return (
    <div className="max-w-lg mx-auto text-center py-24">
      <div className="mx-auto w-11 h-11 rounded-md bg-raised dark:bg-raised-dark border border-line dark:border-line-dark flex items-center justify-center text-muted dark:text-muted-dark">
        <LockKeyhole size={18} />
      </div>
      <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Access not enabled</h1>
      <p className="mt-2 text-[13px] text-muted dark:text-muted-dark leading-relaxed">
        {FEATURE_LABEL[feature]} is currently disabled for {user?.company}. Your account is marked as{' '}
        <span className="font-mono text-ink dark:text-ink-dark">{partnerStatusLabel(user)}</span>.
      </p>
      <Link to={feature === 'zendesk' ? '/app' : '/app/support/new'} className="btn-outline mt-5 inline-flex">
        {feature === 'zendesk' ? 'Back to overview' : 'Request access'}
      </Link>
    </div>
  )
}
