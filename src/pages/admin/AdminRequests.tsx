import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, AlertTriangle, Users, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useData, useLookups } from '../../lib/data'
import { useOutsideClick } from '../../lib/useOutsideClick'
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
  const [statuses, setStatuses] = useState<RequestStatus[]>([])
  const [owners, setOwners] = useState<OwnerTeam[]>([])
  const [urgencies, setUrgencies] = useState<Urgency[]>([])
  const [syncing, setSyncing] = useState(false)

  const open = useMemo(() => serviceRequests.filter((r) => r.status !== 'closed'), [serviceRequests])
  const highUrgentOpen = useMemo(() => open.filter((r) => r.urgency === 'high'), [open])

  const rows = useMemo(
    () =>
      serviceRequests.filter(
        (r) =>
          (statuses.length === 0 || statuses.includes(r.status)) &&
          (owners.length === 0 || owners.includes(r.ownerTeam)) &&
          (urgencies.length === 0 || urgencies.includes(r.urgency)),
      ),
    [serviceRequests, statuses, owners, urgencies],
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
        <MultiSelect label="All statuses" options={REQUEST_STATUSES} selected={statuses} onChange={setStatuses} />
        <MultiSelect label="All teams" options={OWNER_TEAMS} selected={owners} onChange={setOwners} />
        <MultiSelect label="Any urgency" options={URGENCIES} selected={urgencies} onChange={setUrgencies} />
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

function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx('select sm:w-56 text-left truncate', selected.length === 0 && 'text-faint dark:text-faint-dark')}
        aria-label={label}
        aria-expanded={open}
      >
        {summary}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[12rem] card shadow-lift p-1 animate-fade-up z-20">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-2 py-1.5 rounded text-[13px] text-muted dark:text-muted-dark hover:bg-raised dark:hover:bg-raised-dark transition"
          >
            {label}
          </button>
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-raised dark:hover:bg-raised-dark cursor-pointer transition"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-accent"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
