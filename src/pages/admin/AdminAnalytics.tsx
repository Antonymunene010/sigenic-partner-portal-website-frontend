import { useEffect, useState } from 'react'
import { Building2, BadgeCheck, Inbox, Calculator, TrendingUp, Users } from 'lucide-react'
import { getAnalytics } from '../../lib/api'
import { useLookups } from '../../lib/data'
import { PageHeader } from '../../components/PageHeader'
import { Card, StatCard, Spinner } from '../../components/ui'
import { Badge } from '../../components/Badge'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { fmtNumber } from '../../lib/format'
import { COMPANY_TYPE_LABEL } from '../../lib/constants'
import type { CompanyType } from '../../lib/types'

interface Analytics {
  counts: {
    companies: number
    partners: number
    activePartners: number
    prospects: number
    users: number
    openRequests: number
    calculatorRuns: number
    calcToConsultation: number
  }
  requestsByType: Record<string, number>
  requestsByStatus: Record<string, number>
  requestsByOwner: Record<string, number>
  runsByDepartment: Record<string, number>
  topPartners: TopPartner[]
}

interface TopPartner {
  id: string
  name: string
  type: CompanyType
  requests: number
  runs: number
}

type BarRow = { key: string; label: string; value: number }

function BarChart({ rows, accent = false }: { rows: BarRow[]; accent?: boolean }) {
  if (!rows.length) {
    return <p className="text-sm text-muted dark:text-muted-dark">No data yet.</p>
  }
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="truncate capitalize">{r.label}</span>
            <span className="num text-xs text-muted dark:text-muted-dark">{fmtNumber(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-raised dark:bg-raised-dark overflow-hidden">
            <div
              className={`h-full rounded-full ${accent ? 'bg-gold-gradient' : 'bg-accent'}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function toRows(map: Record<string, number> | undefined, label: (k: string) => string): BarRow[] {
  return Object.entries(map ?? {})
    .map(([key, value]) => ({ key, label: label(key), value }))
    .sort((a, b) => b.value - a.value)
}

export default function AdminAnalytics() {
  const lookups = useLookups()
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getAnalytics()
      .then((res) => {
        if (alive) setData(res as unknown as Analytics)
      })
      .catch(() => {
        if (alive) setData(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <Spinner label="Loading analytics" />

  const counts = data?.counts
  const typeRows = toRows(data?.requestsByType, (k) => lookups.requestTypeLabel(k))
  const statusRows = toRows(data?.requestsByStatus, (k) => k.replace('_', ' '))
  const deptRows = toRows(data?.runsByDepartment, (k) => lookups.departmentName(k))
  const topPartners = data?.topPartners ?? []

  const columns: Column<TopPartner>[] = [
    { key: 'name', header: 'Partner', render: (p) => <span className="font-medium">{p.name}</span> },
    {
      key: 'type',
      header: 'Type',
      sortAccessor: (p) => COMPANY_TYPE_LABEL[p.type] ?? p.type,
      render: (p) => <Badge tone="neutral">{COMPANY_TYPE_LABEL[p.type] ?? p.type}</Badge>,
    },
    { key: 'requests', header: 'Requests', className: 'num', render: (p) => fmtNumber(p.requests) },
    { key: 'runs', header: 'Calculator runs', className: 'num', render: (p) => fmtNumber(p.runs) },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Usage & GTM"
        description="Internal view of partner activity, request flow and calculator adoption."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Partners" value={fmtNumber(counts?.partners ?? 0)} icon={<Building2 size={15} />} />
        <StatCard label="Active partners" value={fmtNumber(counts?.activePartners ?? 0)} icon={<BadgeCheck size={15} />} />
        <StatCard label="Open requests" value={fmtNumber(counts?.openRequests ?? 0)} icon={<Inbox size={15} />} />
        <StatCard label="Calculator runs" value={fmtNumber(counts?.calculatorRuns ?? 0)} icon={<Calculator size={15} />} />
        <StatCard
          label="Calc → consultation"
          value={fmtNumber(counts?.calcToConsultation ?? 0)}
          accent
          icon={<TrendingUp size={15} />}
        />
        <StatCard label="Users" value={fmtNumber(counts?.users ?? 0)} icon={<Users size={15} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <Card title="Requests by type" eyebrow="Mix">
          <BarChart rows={typeRows} />
        </Card>
        <Card title="Requests by status" eyebrow="Pipeline">
          <BarChart rows={statusRows} />
        </Card>
        <Card title="Calculator runs by department" eyebrow="Adoption">
          <BarChart rows={deptRows} accent />
        </Card>
      </div>

      <Card title="Top partners" eyebrow="Engagement" padded={false}>
        <DataTable<TopPartner> columns={columns} rows={topPartners} empty="No partner activity yet." />
      </Card>
    </div>
  )
}
