import { useMemo, useState } from 'react'
import { Activity, CalendarClock, LifeBuoy, Sparkles } from 'lucide-react'
import { load } from '../../lib/storage'
import type { Ticket, User } from '../../lib/types'
import { seedTickets, seedUsers } from '../../lib/seed'
import { fmtNumber } from '../../lib/format'
import clsx from 'clsx'

export default function AdminAnalytics() {
  const [tickets] = useState(() => load<Ticket[]>('tickets', seedTickets))
  const [users] = useState(() => load<User[]>('users', seedUsers))

  const stats = useMemo(() => {
    const byArea: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    for (const t of tickets) {
      if (t.productArea) byArea[t.productArea] = (byArea[t.productArea] ?? 0) + 1
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1
    }
    const resolved = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')
    const resolutionHrs = resolved.length
      ? resolved.reduce((a, t) => a + (+new Date(t.updatedAt) - +new Date(t.createdAt)) / 3600000, 0) / resolved.length
      : 0
    const fromCalc = tickets.filter((t) => t.source === 'calculator')
    return {
      total: tickets.length,
      resolved: resolved.length,
      open: tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
      activePartners: users.filter((u) => u.active && u.role === 'partner').length,
      avgResolutionHrs: resolutionHrs,
      calcConversions: fromCalc.length,
      byArea,
      byCategory,
    }
  }, [tickets, users])

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight">Analytics & usage</h2>
        <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">
          Mock figures derived from the current portal state. Production would wire to a warehouse / event stream.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Active partners" value={fmtNumber(stats.activePartners)} icon={Activity} />
        <Kpi label="Open tickets" value={fmtNumber(stats.open)} icon={LifeBuoy} sub={`${stats.resolved} resolved`} />
        <Kpi label="Avg resolution" value={`${stats.avgResolutionHrs.toFixed(1)} hrs`} icon={CalendarClock} sub="rolling" />
        <Kpi label="Calculator → ticket" value={fmtNumber(stats.calcConversions)} icon={Sparkles} sub="consultation requests" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <HorizontalBars title="Tickets by product area" data={stats.byArea} />
        <HorizontalBars title="Tickets by category" data={stats.byCategory} />
      </section>

      <section className="mt-5 card p-5">
        <h3 className="text-[14px] font-medium mb-3">Top active partners</h3>
        <ul className="divide-hair">
          {users
            .filter((u) => u.role === 'partner')
            .map((u) => ({ u, count: tickets.filter((t) => t.requester === u.name).length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(({ u, count }) => (
              <li key={u.id} className="py-2.5 flex items-center justify-between text-[13px]">
                <span>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted dark:text-muted-dark"> · {u.company}</span>
                </span>
                <span className="font-mono num text-[12.5px]">{count} tickets</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof Activity }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="stat-label">{label}</div>
        <Icon size={14} className="text-faint dark:text-faint-dark" />
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-tightest num leading-none">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-muted dark:text-muted-dark">{sub}</div>}
    </div>
  )
}

function HorizontalBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="card p-5">
      <h3 className="text-[14px] font-medium mb-3">{title}</h3>
      <ul className="space-y-2.5">
        {entries.map(([k, v]) => (
          <li key={k}>
            <div className="flex items-baseline justify-between text-[12.5px] mb-1">
              <span className="capitalize">{k}</span>
              <span className="font-mono num text-muted dark:text-muted-dark">{v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-raised dark:bg-raised-dark overflow-hidden">
              <div className={clsx('h-full rounded-full bg-accent transition-all')} style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </li>
        ))}
        {entries.length === 0 && <li className="text-[12px] text-faint dark:text-faint-dark">No data yet.</li>}
      </ul>
    </div>
  )
}
