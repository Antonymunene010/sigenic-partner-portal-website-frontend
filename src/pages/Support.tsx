import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, Plus, Search } from 'lucide-react'
import { load } from '../lib/storage'
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from '../lib/types'
import { seedTickets } from '../lib/seed'
import { Badge } from '../components/Badge'
import { PageHeader } from '../components/PageHeader'
import { fmtRelative } from '../lib/format'

const STATUSES: TicketStatus[] = ['open', 'pending', 'solved', 'closed']
const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low']
const CATS: TicketCategory[] = ['technical', 'billing', 'demo', 'general', 'feature']

export default function Support() {
  const tickets = load<Ticket[]>('tickets', seedTickets)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<TicketStatus | 'all'>('all')
  const [priority, setPriority] = useState<TicketPriority | 'all'>('all')
  const [category, setCategory] = useState<TicketCategory | 'all'>('all')

  const filtered = useMemo(() => {
    return tickets
      .filter((t) => (status === 'all' ? true : t.status === status))
      .filter((t) => (priority === 'all' ? true : t.priority === priority))
      .filter((t) => (category === 'all' ? true : t.category === category))
      .filter((t) =>
        q.trim() === ''
          ? true
          : (t.subject + ' ' + t.id + ' ' + t.tags.join(' ')).toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  }, [tickets, q, status, priority, category])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tickets.length }
    for (const s of STATUSES) c[s] = tickets.filter((t) => t.status === s).length
    return c
  }, [tickets])

  return (
    <div>
      <PageHeader
        eyebrow="Support · Zendesk-integrated"
        title="Tickets"
        description="Every portal request is mirrored to Zendesk and routed by category. SLAs apply from the first business-hour response."
        actions={
          <Link to="/app/support/new" className="btn-accent">
            <Plus size={14} /> New ticket
          </Link>
        }
      />

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-line dark:border-line-dark">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s as any)}
            className={`relative h-9 px-3 text-[13px] transition ${
              status === s
                ? 'text-ink dark:text-ink-dark font-medium'
                : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
            }`}
          >
            <span className="capitalize">{s}</span>
            <span className="ml-1.5 text-[11px] font-mono text-faint dark:text-faint-dark">
              {counts[s] ?? 0}
            </span>
            {status === s && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-ink dark:bg-ink-dark" />}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by subject, ID, or tag…"
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted dark:text-muted-dark">
          <Filter size={13} />
          Filters
        </div>
        <select className="select h-9 w-[130px]" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
          <option value="all">All priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select h-9 w-[150px]" value={category} onChange={(e) => setCategory(e.target.value as any)}>
          <option value="all">All categories</option>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-24">ID</th>
              <th>Subject</th>
              <th className="w-28">Status</th>
              <th className="w-28">Priority</th>
              <th className="w-28">Category</th>
              <th className="w-36 text-right pr-4">Updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-[12px] text-muted dark:text-muted-dark">
                  <Link to={`/app/support/${t.id}`} className="hover:text-ink dark:hover:text-ink-dark">
                    {t.id}
                  </Link>
                </td>
                <td>
                  <Link to={`/app/support/${t.id}`} className="block">
                    <div className="font-medium text-[13.5px] text-ink dark:text-ink-dark">{t.subject}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {t.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[10.5px] font-mono text-muted dark:text-muted-dark px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                </td>
                <td><Badge tone={t.status} dot>{t.status}</Badge></td>
                <td><Badge tone={t.priority}>{t.priority}</Badge></td>
                <td className="capitalize text-muted dark:text-muted-dark text-[12.5px]">{t.category}</td>
                <td className="text-right pr-4 font-mono text-[11.5px] text-muted dark:text-muted-dark">
                  {fmtRelative(t.updatedAt)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-14 text-muted dark:text-muted-dark text-[13px]">
                  No tickets match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark">
        Showing {filtered.length} of {tickets.length}
      </div>
    </div>
  )
}
