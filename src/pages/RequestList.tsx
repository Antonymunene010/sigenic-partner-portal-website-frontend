import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData, useLookups } from '../lib/data'
import { isInternal } from '../lib/permissions'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Badge } from '../components/Badge'
import { Spinner, chipClass } from '../components/ui'
import { fmtRelative } from '../lib/format'
import { REQUEST_STATUSES, REQUEST_STATUS_TONE, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, URGENCY_TONE } from '../lib/constants'
import type { RequestStatus, ServiceRequest } from '../lib/types'

export default function RequestList() {
  const { user } = useAuth()
  const { serviceRequests, ready } = useData()
  const { companyName } = useLookups()
  const navigate = useNavigate()
  const [status, setStatus] = useState<RequestStatus | 'all'>('all')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    return serviceRequests.filter(
      (r) => (status === 'all' || r.status === status) && (!q || r.title.toLowerCase().includes(q.toLowerCase()) || r.id.toLowerCase().includes(q.toLowerCase())),
    )
  }, [serviceRequests, status, q])

  if (!ready) return <Spinner />

  const internal = isInternal(user)
  const columns: Column<ServiceRequest>[] = [
    { key: 'title', header: 'Request', render: (r) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{r.title}</div>
        <div className="text-xs text-muted dark:text-muted-dark">{REQUEST_TYPE_LABEL[r.requestType]}{internal && r.companyId ? ` · ${companyName(r.companyId)}` : ''}</div>
      </div>
    ) },
    { key: 'urgency', header: 'Urgency', render: (r) => <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency}</Badge> },
    { key: 'owner', header: 'Owner', render: (r) => <span className="text-muted dark:text-muted-dark capitalize">{r.ownerTeam}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={REQUEST_STATUS_TONE[r.status]} dot>{REQUEST_STATUS_LABEL[r.status]}</Badge> },
    { key: 'updated', header: 'Updated', className: 'text-right', render: (r) => <span className="text-xs text-faint dark:text-faint-dark">{fmtRelative(r.updatedAt)}</span> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={internal ? 'Request oversight' : 'Your requests'}
        title="Requests"
        description={internal ? 'All structured requests across partners.' : 'Support, demo, consultation and other requests for your company.'}
        actions={<Link to="/app/requests/new" className="btn-accent"><Plus size={15} /> New request</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', ...REQUEST_STATUSES.map((s) => s.value)] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={chipClass(status === s)}>
              {s === 'all' ? 'All' : REQUEST_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-8 w-56" placeholder="Search requests…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <DataTable columns={columns} rows={rows} onRowClick={(r) => navigate(`/app/requests/${r.id}`)} />
    </div>
  )
}
