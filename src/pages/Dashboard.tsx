import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Calculator, Activity, TrendingUp, CircleDot, BookOpen, LifeBuoy, CalendarClock } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { load } from '../lib/storage'
import type { Ticket, Invoice } from '../lib/types'
import { seedTickets, seedInvoices } from '../lib/seed'
import { Badge } from '../components/Badge'
import { fmtDate, fmtRelative, fmtUSD } from '../lib/format'

export default function Dashboard() {
  const { user } = useAuth()
  const [tickets] = useState(() => load<Ticket[]>('tickets', seedTickets))
  const [invoices] = useState(() => load<Invoice[]>('invoices', seedInvoices))
  const [latestResult] = useState(() =>
    load<{ savingsAnnual: number; score: number; at: string } | null>('calc.latest', null),
  )

  const { openTickets, recent, nextInvoice } = useMemo(() => {
    return {
      openTickets: tickets.filter((t) => t.status === 'open' || t.status === 'in_progress'),
      recent: [...tickets]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 5),
      nextInvoice: invoices.find((i) => i.status === 'open') ?? invoices[0],
    }
  }, [tickets, invoices])

  const kpis = useMemo(() => [
    {
      label: 'Open tickets',
      value: openTickets.length,
      sub: `${tickets.filter((t) => t.priority === 'high' || t.priority === 'urgent').length} high priority`,
      icon: LifeBuoy,
      to: '/app/support',
    },
    {
      label: 'Est. annual savings',
      value: latestResult ? fmtUSD(latestResult.savingsAnnual) : '—',
      sub: latestResult
        ? `Score ${latestResult.score} · ${fmtRelative(latestResult.at)}`
        : 'Run the calculator',
      icon: TrendingUp,
      to: '/app/calculator',
    },
    {
      label: 'Active service requests',
      value: tickets.filter(
        (t) => ['demo', 'onboarding', 'data', 'consulting'].includes(t.category) && t.status !== 'closed' && t.status !== 'resolved',
      ).length,
      sub: 'Demo · onboarding · analysis · consulting',
      icon: CalendarClock,
      to: '/app/services',
    },
    {
      label: 'Next invoice',
      value: nextInvoice ? fmtUSD(nextInvoice.amount) : '—',
      sub: nextInvoice ? `Due ${fmtDate(nextInvoice.periodEnd)}` : '',
      icon: Activity,
      to: '/app/billing',
    },
  ], [tickets, latestResult, nextInvoice, openTickets.length])

  return (
    <div>
      <section className="mb-10">
        <div className="eyebrow mb-3">Overview · SG-1</div>
        <h1 className="text-[32px] md:text-[42px] font-semibold tracking-tightest leading-[1.05]">
          {greet()}, {user?.name.split(' ')[0]}.
        </h1>
        <p className="mt-2 text-[15px] text-muted dark:text-muted-dark max-w-xl text-pretty">
          Here's what's moving across your partnership with Sigenic this week.
        </p>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {kpis.map((k) => (
          <Link
            key={k.label}
            to={k.to}
            className="group card p-4 hover:shadow-soft hover:border-line-strong dark:hover:border-line-strong-dark transition relative overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div className="stat-label">{k.label}</div>
              <k.icon size={14} strokeWidth={1.75} className="text-faint dark:text-faint-dark group-hover:text-accent transition" />
            </div>
            <div className="mt-3 text-[28px] font-semibold tracking-tightest num leading-none">
              {k.value}
            </div>
            <div className="mt-2 text-[11px] text-muted dark:text-muted-dark">{k.sub}</div>
            <ArrowUpRight
              size={14}
              className="absolute bottom-3 right-3 text-faint dark:text-faint-dark opacity-0 group-hover:opacity-100 transition"
            />
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line dark:border-line-dark">
            <div>
              <div className="text-[13px] font-medium">Recent ticket activity</div>
              <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
                {openTickets.length} open · {tickets.length} total
              </div>
            </div>
            <Link to="/app/support" className="btn-ghost text-[12px] h-7 px-2">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          <ul className="divide-hair">
            {recent.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/app/support/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60 dark:hover:bg-raised-dark/60 transition"
                >
                  <Badge tone={t.status} dot />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{t.subject}</div>
                    <div className="text-[11px] text-muted dark:text-muted-dark font-mono">
                      {t.id} · {fmtRelative(t.updatedAt)}
                    </div>
                  </div>
                  <Badge tone={t.priority}>{t.priority}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-5">
          <div className="relative card-raised p-5 overflow-hidden bg-ink text-canvas dark:bg-surface-dark dark:text-ink-dark">
            <div className="absolute inset-0 bg-grid opacity-40" />
            <div
              className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl opacity-20"
              style={{ background: 'radial-gradient(circle, #CCFF00 0%, transparent 60%)' }}
            />
            <div className="relative">
              <div className="eyebrow text-white/60 dark:text-muted-dark before:bg-white/30 dark:before:bg-muted-dark">
                Core tool
              </div>
              <h3 className="mt-2 text-[22px] font-semibold tracking-tightest leading-tight">
                Model your next <span className="font-serif italic font-normal text-accent">savings</span>.
              </h3>
              <p className="mt-2 text-[13px] text-white/70 dark:text-muted-dark">
                Pick machines, processes, and volume — get an estimate in seconds.
              </p>
              <Link to="/app/calculator" className="mt-4 btn-accent inline-flex">
                <Calculator size={14} /> Open calculator
              </Link>
            </div>
          </div>

          <div className="card p-1">
            <div className="px-3 py-2.5 border-b border-line dark:border-line-dark">
              <div className="text-[12px] font-medium">Quick actions</div>
            </div>
            <ul>
              {[
                { to: '/app/support/new', label: 'Submit a support request', icon: LifeBuoy },
                { to: '/app/services', label: 'Request a service', icon: CalendarClock },
                { to: '/app/docs', label: 'Browse knowledge base', icon: BookOpen },
              ].map((a) => (
                <li key={a.to}>
                  <Link
                    to={a.to}
                    className="flex items-center justify-between px-3 py-2.5 text-[13px] hover:bg-raised/60 dark:hover:bg-raised-dark/60 rounded-md"
                  >
                    <span className="flex items-center gap-2">
                      <a.icon size={14} className="text-muted dark:text-muted-dark" />
                      {a.label}
                    </span>
                    <ArrowUpRight size={13} className="text-faint dark:text-faint-dark" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CircleDot size={12} className="text-success" />
              <div className="text-[12px] font-medium">System status</div>
            </div>
            <ul className="space-y-2 text-[12px]">
              {[
                { k: 'Portal API', v: 'Operational' },
                { k: 'Ingest · SG-1', v: 'Operational' },
                { k: 'Ingest · EU-1', v: 'Operational' },
                { k: 'Viewer', v: 'Operational' },
              ].map((s) => (
                <li key={s.k} className="flex items-center justify-between">
                  <span className="text-muted dark:text-muted-dark font-mono text-[11px] uppercase tracking-[0.08em]">
                    {s.k}
                  </span>
                  <span className="flex items-center gap-1.5 text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    {s.v}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}

function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
