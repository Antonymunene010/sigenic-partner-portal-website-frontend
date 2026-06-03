import { Link } from 'react-router-dom'
import { Calculator, Inbox, BookOpen, Building2, Users, ArrowUpRight, Megaphone, TrendingUp } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { isInternal } from '../lib/permissions'
import { PageHeader } from '../components/PageHeader'
import { Card, StatCard, Spinner, EmptyState } from '../components/ui'
import { Badge } from '../components/Badge'
import { fmtUSD, fmtRelative } from '../lib/format'
import { REQUEST_STATUS_TONE, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, ONBOARDING_STATUS_LABEL } from '../lib/constants'

export default function Dashboard() {
  const { user } = useAuth()
  const data = useData()
  if (!user) return null
  if (!data.ready) return <Spinner />
  return isInternal(user) ? <InternalDashboard /> : <PortalDashboard />
}

function AnnouncementList() {
  const { announcements } = useData()
  if (!announcements.length) return <EmptyState title="No announcements" />
  return (
    <ul className="divide-hair">
      {announcements.slice(0, 4).map((a) => (
        <li key={a.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            {a.pinned && <Badge tone="accent">pinned</Badge>}
            <span className="text-sm font-medium">{a.title}</span>
          </div>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark line-clamp-2">{a.body}</p>
          <span className="text-[11px] font-mono text-faint dark:text-faint-dark">{fmtRelative(a.publishAt)}</span>
        </li>
      ))}
    </ul>
  )
}

function PortalDashboard() {
  const { user } = useAuth()
  const { company, serviceRequests, calculatorRuns } = useData()
  const openReqs = serviceRequests.filter((r) => r.status !== 'closed')
  const latestRun = calculatorRuns[0]

  return (
    <div>
      <PageHeader
        eyebrow={company?.companyName ?? 'Partner'}
        title={`Welcome, ${user?.fullName.split(' ')[0]}`}
        description="Run an ROI estimate, browse the knowledge base, or raise a request — all in one place."
        actions={
          <Link to="/app/calculator" className="btn-accent">
            <Calculator size={15} /> Run calculator
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open requests" value={openReqs.length} icon={<Inbox size={15} />} />
        <StatCard label="Calculator runs" value={calculatorRuns.length} icon={<Calculator size={15} />} />
        <StatCard
          label="Est. annual savings"
          value={latestRun?.estimatedAnnualSavingsMax ? fmtUSD(latestRun.estimatedAnnualSavingsMax) : '—'}
          accent
          icon={<TrendingUp size={15} />}
        />
        <StatCard label="Onboarding" value={company ? ONBOARDING_STATUS_LABEL[company.onboardingStatus] : '—'} icon={<Building2 size={15} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Recent requests" className="lg:col-span-2" actions={<Link to="/app/requests" className="btn-ghost text-xs">View all</Link>}>
          {serviceRequests.length === 0 ? (
            <EmptyState title="No requests yet" hint="Raise a support, demo or consultation request." action={<Link to="/app/requests/new" className="btn-outline">New request</Link>} />
          ) : (
            <ul className="divide-hair">
              {serviceRequests.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to={`/app/requests/${r.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 group">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-emphasis">{r.title}</div>
                      <div className="text-xs text-muted dark:text-muted-dark">{REQUEST_TYPE_LABEL[r.requestType]} · {fmtRelative(r.updatedAt)}</div>
                    </div>
                    <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><Megaphone size={14} /> Announcements</span>}>
          <AnnouncementList />
        </Card>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-5">
        <QuickLink to="/app/calculator" icon={<Calculator size={16} />} label="ROI calculator" hint="Estimate savings" />
        <QuickLink to="/app/knowledge" icon={<BookOpen size={16} />} label="Knowledge base" hint="Guides & FAQs" />
        <QuickLink to="/app/requests/new" icon={<Inbox size={16} />} label="New request" hint="Support / demo" />
      </div>
    </div>
  )
}

function InternalDashboard() {
  const { user } = useAuth()
  const { companies, serviceRequests, calculatorRuns, users } = useData()
  const partners = companies.filter((c) => c.companyType !== 'sigenic')
  const openReqs = serviceRequests.filter((r) => r.status !== 'closed')
  const highUrgency = serviceRequests.filter((r) => r.urgency === 'high' && r.status !== 'closed')

  return (
    <div>
      <PageHeader
        eyebrow="Internal · Sigenic"
        title={`Operations overview`}
        description={`Signed in as ${user?.fullName}. Manage partners, scoring logic and request oversight.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Partner companies" value={partners.length} icon={<Building2 size={15} />} />
        <StatCard label="Open requests" value={openReqs.length} sub={`${highUrgency.length} high urgency`} icon={<Inbox size={15} />} accent={highUrgency.length > 0} />
        <StatCard label="Calculator runs" value={calculatorRuns.length} icon={<Calculator size={15} />} />
        <StatCard label="Users" value={users.length} icon={<Users size={15} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Request oversight" className="lg:col-span-2" actions={<Link to="/app/admin/requests" className="btn-ghost text-xs">Open</Link>}>
          {serviceRequests.length === 0 ? (
            <EmptyState title="No requests" />
          ) : (
            <ul className="divide-hair">
              {serviceRequests.slice(0, 7).map((r) => (
                <li key={r.id}>
                  <Link to={`/app/requests/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 group">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-emphasis">{r.title}</div>
                      <div className="text-xs text-muted dark:text-muted-dark">{REQUEST_TYPE_LABEL[r.requestType]} · {r.ownerTeam}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.urgency === 'high' && <Badge tone="danger">high</Badge>}
                      <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><Megaphone size={14} /> Announcements</span>} actions={<Link to="/app/admin/announcements" className="btn-ghost text-xs">Manage</Link>}>
          <AnnouncementList />
        </Card>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mt-5">
        <QuickLink to="/app/admin/companies" icon={<Building2 size={16} />} label="Partners" hint="Companies & sites" />
        <QuickLink to="/app/admin/scoring" icon={<Calculator size={16} />} label="Scoring" hint="Models & rules" />
        <QuickLink to="/app/admin/master-data" icon={<BookOpen size={16} />} label="Master data" hint="Machines & processes" />
        <QuickLink to="/app/admin/analytics" icon={<TrendingUp size={16} />} label="Analytics" hint="Usage & GTM" />
      </div>
    </div>
  )
}

function QuickLink({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link to={to} className="card p-4 flex items-center gap-3 hover:shadow-soft transition group">
      <div className="w-9 h-9 rounded-md bg-raised dark:bg-raised-dark flex items-center justify-center text-emphasis">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted dark:text-muted-dark">{hint}</div>
      </div>
      <ArrowUpRight size={15} className="text-faint group-hover:text-ink dark:group-hover:text-ink-dark transition" />
    </Link>
  )
}
