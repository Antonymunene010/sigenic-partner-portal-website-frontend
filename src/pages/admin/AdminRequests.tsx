import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, AlertTriangle, Users, RefreshCw } from 'lucide-react'
import { useData, useLookups } from '../../lib/data'
import { PageHeader } from '../../components/PageHeader'
import { DataTable, type Column } from '../../components/DataTable'
import { Badge } from '../../components/Badge'
import { StatCard, Spinner, useToast } from '../../components/ui'
import { syncRequests } from '../../lib/api'
import { fmtRelative } from '../../lib/format'
import {
  OWNER_TEAMS,
  REQUEST_STATUSES,
  REQUEST_STATUS_TONE,
  REQUEST_STATUS_LABEL,
  URGENCIES,
  URGENCY_TONE,
} from '../../lib/constants'
import type { OwnerTeam, RequestStatus, ServiceRequest, Urgency } from '../../lib/types'

export default function AdminRequests() {
  const { serviceRequests, ready, refresh } = useData()
  const { companyName, requestTypeLabel } = useLookups()
  const { push } = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState<RequestStatus | 'all'>('all')
  const [owner, setOwner] = useState<OwnerTeam | 'all'>('all')
  const [urgency, setUrgency] = useState<Urgency | 'all'>('all')
  const [syncing, setSyncing] = useState(false)

  const open = useMemo(() => serviceRequests.filter((r) => r.status !== 'closed'), [serviceRequests])
  const highUrgentOpen = useMemo(() => open.filter((r) => r.urgency === 'high'), [open])

  const rows = useMemo(
    () =>
      serviceRequests.filter(
        (r) =>
          (status === 'all' || r.status === status) &&
          (owner === 'all' || r.ownerTeam === owner) &&
          (urgency === 'all' || r.urgency === urgency),
      ),
    [serviceRequests, status, owner, urgency],
  )

  async function handleSync() {
    setSyncing(true)
    try {
      const { synced } = await syncRequests()
      await refresh()
      push(synced > 0 ? `Synced ${synced} request${synced === 1 ? '' : 's'} from Zendesk.` : 'Already up to date.', 'success')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Sync failed.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (!ready) return <Spinner />

  const columns: Column<ServiceRequest>[] = [
    {
      key: 'title',
      header: 'Request',
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium truncate">{r.title}</div>
          <div className="text-xs text-muted dark:text-muted-dark">
            {requestTypeLabel(r.requestType)}
            {r.companyId ? ` · ${companyName(r.companyId)}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'urgency', header: 'Urgency', render: (r) => <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge> },
    {
      key: 'owner',
      header: 'Owner',
      sortAccessor: (r) => r.ownerTeam,
      render: (r) => <span className="text-muted dark:text-muted-dark capitalize">{r.ownerTeam}</span>,
    },
    {
      key: 'zendesk',
      header: 'Zendesk',
      sortAccessor: (r) => r.zendeskTicketId,
      render: (r) =>
        r.zendeskTicketId ? (
          <Badge tone="info">#{r.zendeskTicketId}</Badge>
        ) : (
          <span className="text-faint dark:text-faint-dark">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={REQUEST_STATUS_TONE[r.status]} dot>
          {REQUEST_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      className: 'text-right',
      sortAccessor: (r) => r.updatedAt,
      render: (r) => <span className="text-xs text-faint dark:text-faint-dark">{fmtRelative(r.updatedAt)}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Oversight"
        title="Request oversight"
        description="All structured requests across partners, routed by owner team."
        actions={
          <button onClick={handleSync} disabled={syncing} className="btn-accent">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync Zendesk'}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open requests" value={open.length} icon={<Inbox size={15} />} />
        <StatCard
          label="High urgency open"
          value={highUrgentOpen.length}
          sub="needs attention"
          icon={<AlertTriangle size={15} />}
          accent={highUrgentOpen.length > 0}
        />
        <StatCard label="Total requests" value={serviceRequests.length} icon={<Users size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FilterSelect value={status} onChange={setStatus} label="Filter by status" allLabel="All statuses" options={REQUEST_STATUSES} />
        <FilterSelect value={owner} onChange={setOwner} label="Filter by owner team" allLabel="All teams" options={OWNER_TEAMS} />
        <FilterSelect value={urgency} onChange={setUrgency} label="Filter by urgency" allLabel="Any urgency" options={URGENCIES} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => navigate(`/app/requests/${r.id}`)}
        empty="No requests match these filters."
        defaultSort={{ key: 'updated', dir: 'desc' }}
      />
    </div>
  )
}

function FilterSelect<T extends string>({
  value,
  onChange,
  label,
  allLabel,
  options,
}: {
  value: T | 'all'
  onChange: (value: T | 'all') => void
  label: string
  allLabel: string
  options: { value: T; label: string }[]
}) {
  return (
    <select
      className="select sm:w-56"
      value={value}
      onChange={(e) => onChange(e.target.value as T | 'all')}
      aria-label={label}
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
