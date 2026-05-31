import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, MapPin } from 'lucide-react'
import { useData } from '../lib/data'
import { roleLabel } from '../lib/permissions'
import { PageHeader } from '../components/PageHeader'
import { Card, Spinner, EmptyState } from '../components/ui'
import { Badge } from '../components/Badge'
import { Avatar } from '../components/Avatar'
import { DescRow } from '../components/DescRow'
import { DataTable } from '../components/DataTable'
import type { Column } from '../components/DataTable'
import { fmtDate } from '../lib/format'
import {
  COMPANY_TYPE_LABEL,
  ORG_STATUS_TONE,
  ONBOARDING_STATUS_LABEL,
  USER_STATUS_TONE,
} from '../lib/constants'
import type { Site, User } from '../lib/types'

export default function CompanyProfile() {
  const { company, sites, users, ready } = useData()

  if (!ready) return <Spinner />

  if (!company) {
    return (
      <Card>
        <EmptyState
          title="No company on file"
          hint="Your account isn't linked to a partner organization yet. Contact your Sigenic representative."
        />
      </Card>
    )
  }

  const companySites = sites.filter((s) => s.companyId === company.id)
  const companyUsers = users.filter((u) => u.companyId === company.id)
  const milestones = company.onboardingMilestones ?? []

  const siteColumns: Column<Site>[] = [
    {
      key: 'siteName',
      header: 'Site',
      render: (s) => (
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-faint shrink-0" />
          <span className="font-medium">{s.siteName}</span>
        </div>
      ),
    },
    { key: 'siteCode', header: 'Code', render: (s) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{s.siteCode ?? '—'}</span> },
    { key: 'location', header: 'Location', render: (s) => s.location ?? '—' },
    {
      key: 'status',
      header: 'Status',
      className: 'text-right',
      render: (s) => <Badge tone={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge>,
    },
  ]

  return (
    <div>
      <PageHeader eyebrow={COMPANY_TYPE_LABEL[company.companyType]} title={company.companyName} />

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Company">
            <dl className="space-y-2.5 text-sm">
              <DescRow k="Industry" v={company.industry ?? '—'} />
              <DescRow k="Status" v={<Badge tone={ORG_STATUS_TONE[company.status]} dot>{company.status}</Badge>} />
              <DescRow k="Onboarding" v={ONBOARDING_STATUS_LABEL[company.onboardingStatus]} />
              <DescRow k="Service tier" v={company.serviceTier ?? '—'} />
              <DescRow k="Subscription" v={company.subscriptionType ?? '—'} />
              <DescRow k="Contract start" v={company.contractStart ? fmtDate(company.contractStart) : '—'} />
              <DescRow k="Renewal date" v={company.renewalDate ? fmtDate(company.renewalDate) : '—'} />
              <DescRow
                k="Billing contact"
                v={
                  company.billingContactName || company.billingContactEmail ? (
                    <span>
                      {company.billingContactName ?? '—'}
                      {company.billingContactEmail && (
                        <span className="block text-xs text-muted dark:text-muted-dark">{company.billingContactEmail}</span>
                      )}
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
            </dl>
          </Card>

          <Card title="Sites / fabs">
            {companySites.length === 0 ? (
              <EmptyState title="No sites yet" hint="Sites are added as your account is provisioned." />
            ) : (
              <DataTable columns={siteColumns} rows={companySites} defaultSort={{ key: 'updatedAt', dir: 'desc' }} />
            )}
          </Card>

          <Card title="Team" actions={<Link to="/app/users" className="btn-ghost text-xs">Manage</Link>}>
            {companyUsers.length === 0 ? (
              <EmptyState title="No team members yet" />
            ) : (
              <ul className="divide-hair">
                {companyUsers.map((u: User) => (
                  <li key={u.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar name={u.fullName} variant="faint" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{u.fullName}</div>
                      <div className="text-xs text-muted dark:text-muted-dark truncate">{u.email}</div>
                    </div>
                    <span className="text-xs text-muted dark:text-muted-dark shrink-0">{roleLabel(u.role)}</span>
                    <Badge tone={USER_STATUS_TONE[u.status]}>{u.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Onboarding" eyebrow={ONBOARDING_STATUS_LABEL[company.onboardingStatus]}>
            {milestones.length === 0 ? (
              <EmptyState title="No milestones" />
            ) : (
              <ul className="space-y-2.5">
                {milestones.map((m) => (
                  <li key={m.key} className="flex items-start gap-2.5 text-sm">
                    {m.done ? (
                      <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={16} className="text-faint shrink-0 mt-0.5" />
                    )}
                    <span className={m.done ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark'}>{m.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
