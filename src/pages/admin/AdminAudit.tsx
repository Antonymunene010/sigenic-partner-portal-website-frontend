import { useMemo, useState } from 'react'
import { useData } from '../../lib/data'
import { PageHeader } from '../../components/PageHeader'
import { Card, EmptyState, Field, Spinner } from '../../components/ui'
import { Badge } from '../../components/Badge'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { fmtDateTime } from '../../lib/format'
import type { AuditLog } from '../../lib/types'

export default function AdminAudit() {
  const { auditLogs, ready } = useData()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (!q) return base
    return base.filter((l) => l.entityType.toLowerCase().includes(q))
  }, [auditLogs, query])

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'When',
      render: (l) => <span className="text-muted dark:text-muted-dark">{fmtDateTime(l.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (l) => <span className="font-medium">{l.actorName ?? 'System'}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (l) => <Badge tone="neutral">{l.action}</Badge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (l) => (
        <span className="text-muted dark:text-muted-dark">
          <span className="font-mono text-xs">{l.entityType}</span>
          {l.entityId ? <span> · {l.entityId.slice(0, 8)}</span> : null}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Audit"
        title="Change history"
        description="Tracks who changed scoring, machines, companies, permissions, content."
      />

      {!ready ? (
        <Spinner label="Loading audit trail…" />
      ) : auditLogs.length === 0 ? (
        <EmptyState title="No audit events yet" hint="Configuration changes will appear here as they happen." />
      ) : (
        <Card padded={false}>
          <div className="p-4 border-b border-line dark:border-line-dark">
            <Field label="Filter by entity type" htmlFor="audit-filter">
              <input
                id="audit-filter"
                className="input"
                placeholder="e.g. scoring_model, machine, company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
          </div>
          <DataTable<AuditLog>
            columns={columns}
            rows={rows}
            empty={<EmptyState title="No matching events" hint="Try a different entity type." />}
          />
        </Card>
      )}
    </div>
  )
}
