import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  ArrowRight,
  Calculator as CalcIcon,
  TrendingUp,
  CircleDot,
  BookOpen,
  LifeBuoy,
  CalendarClock,
  ShieldCheck,
  Activity,
  Quote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../lib/auth'
import { load } from '../lib/storage'
import type { Ticket, Invoice, SuccessStory, Doc } from '../lib/types'
import { seedTickets, seedInvoices, seedStories, seedDocs } from '../lib/seed'
import { Badge } from '../components/Badge'
import { fmtDate, fmtRelative, fmtUSD } from '../lib/format'
import { PARTNER_LOGOS, INDUSTRIES, PARTNER_EVENTS } from '../lib/partners'

export default function Dashboard() {
  const { user } = useAuth()
  const [tickets] = useState(() => load<Ticket[]>('tickets', seedTickets))
  const [invoices] = useState(() => load<Invoice[]>('invoices', seedInvoices))
  const [stories] = useState(() => load<SuccessStory[]>('stories', seedStories))
  const [docs] = useState(() => load<Doc[]>('docs', seedDocs))
  const [latestResult] = useState(() =>
    load<{ savingsAnnual: number; score: number; at: string } | null>('calc.latest', null),
  )

  const openTickets = useMemo(
    () => tickets.filter((t) => t.status === 'open' || t.status === 'in_progress'),
    [tickets],
  )
  const highPriorityCount = useMemo(
    () => tickets.filter((t) => t.priority === 'high' || t.priority === 'urgent').length,
    [tickets],
  )
  const activeServiceCount = useMemo(
    () =>
      tickets.filter(
        (t) =>
          ['demo', 'onboarding', 'data', 'consulting'].includes(t.category) &&
          t.status !== 'closed' &&
          t.status !== 'resolved',
      ).length,
    [tickets],
  )
  const recentTickets = useMemo(
    () =>
      [...tickets]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 4),
    [tickets],
  )
  const nextInvoice = useMemo(
    () => invoices.find((i) => i.status === 'open') ?? invoices[0],
    [invoices],
  )
  const featured = useMemo(() => stories.find((s) => s.featured) ?? stories[0], [stories])
  const otherStories = useMemo(
    () => stories.filter((s) => s.id !== featured?.id).slice(0, 3),
    [stories, featured],
  )
  const topDocs = useMemo(
    () =>
      [...docs]
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .slice(0, 4),
    [docs],
  )

  return (
    <>
      <section className="relative overflow-hidden bg-ink dark:bg-surface-dark text-canvas dark:text-ink-dark border-b border-line dark:border-line-dark">
        <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-20 bg-accent-glow"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-10 bg-accent-glow"
          aria-hidden
        />

        <div className="relative max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-2xs font-mono uppercase tracking-[0.16em] text-white/60 dark:text-muted-dark">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
                Partner Portal · APAC · SG-1
              </div>
              <h1 className="mt-5 text-[40px] md:text-[60px] lg:text-[68px] font-semibold tracking-tightest leading-[1.02] text-balance">
                {greet()}, {user?.name.split(' ')[0]}.{' '}
                <span className="text-accent">Let's ship yield.</span>
              </h1>
              <p className="mt-5 text-[15.5px] md:text-[17px] text-white/70 dark:text-muted-dark max-w-2xl leading-relaxed text-pretty">
                Your partnership with Sigenic in one place — measurable outcomes from the field,
                a savings model tuned to your fab, and direct lines into support and engineering.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/app/calculator" className="btn-accent">
                  <CalcIcon size={14} /> Model your savings
                </Link>
                <Link
                  to="/app/stories"
                  className="btn border border-white/15 text-canvas hover:bg-white/5 dark:border-line-dark dark:text-ink-dark dark:hover:bg-raised-dark"
                >
                  Browse success stories <ArrowRight size={14} />
                </Link>
                <Link
                  to="/app/services"
                  className="btn text-white/70 hover:text-canvas dark:text-muted-dark dark:hover:text-ink-dark"
                >
                  Request a service
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-px bg-white/10 dark:bg-line-dark rounded-lg overflow-hidden border border-white/10 dark:border-line-dark">
                <HeroStat
                  label="Open tickets"
                  value={String(openTickets.length)}
                  sub={`${highPriorityCount} high priority`}
                  icon={LifeBuoy}
                  to="/app/support"
                />
                <HeroStat
                  label="Est. annual savings"
                  value={latestResult ? fmtUSD(latestResult.savingsAnnual) : '—'}
                  sub={latestResult ? `Score ${latestResult.score}` : 'Run the calculator'}
                  icon={TrendingUp}
                  to="/app/calculator"
                />
                <HeroStat
                  label="Active services"
                  value={String(activeServiceCount)}
                  sub="Demo · onboarding · data · consulting"
                  icon={CalendarClock}
                  to="/app/services"
                />
                <HeroStat
                  label="Next invoice"
                  value={nextInvoice ? fmtUSD(nextInvoice.amount) : '—'}
                  sub={nextInvoice ? `Due ${fmtDate(nextInvoice.periodEnd)}` : ''}
                  icon={Activity}
                  to="/app/billing"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {featured && (
        <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-14 md:pt-20">
          <SectionHead
            eyebrow="Success stories — featured"
            title={
              <>
                Results,{' '}
                <span className="text-accent">not ambition.</span>
              </>
            }
            description="Selected outcomes from partnerships across APAC. Every case is measurable, recent, and reproducible — no marketing fluff."
            cta={{ label: 'All success stories', to: '/app/stories' }}
          />

          <Link
            to={`/app/stories/${featured.slug}`}
            className="mt-8 group block card-raised overflow-hidden relative"
          >
            <div className="grid grid-cols-1 md:grid-cols-5">
              <div className="md:col-span-3 p-8 md:p-10 relative">
                <div className="eyebrow mb-4">
                  Featured · {featured.industry} · {featured.region}
                </div>
                <h3 className="text-[28px] md:text-[34px] font-semibold tracking-tightest leading-[1.08] text-balance">
                  {featured.title}
                </h3>
                <p className="mt-4 text-[14.5px] text-muted dark:text-muted-dark text-pretty leading-relaxed max-w-xl">
                  {featured.summary}
                </p>
                <div className="mt-6 flex items-center gap-7 flex-wrap">
                  {featured.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="text-2xs uppercase tracking-[0.12em] text-muted dark:text-muted-dark">
                        {m.label}
                      </div>
                      <div className="text-[22px] font-semibold tracking-tight num text-ink dark:text-ink-dark mt-0.5">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex items-center gap-2 text-[12px] text-muted dark:text-muted-dark font-mono uppercase tracking-[0.1em]">
                  <span>{featured.partner}</span>
                  <span className="opacity-40">·</span>
                  <span>Published {fmtDate(featured.publishedAt)}</span>
                </div>
                <ArrowUpRight
                  size={20}
                  className="absolute top-6 right-6 text-muted dark:text-muted-dark group-hover:text-accent transition"
                />
              </div>
              <div className="md:col-span-2 relative bg-ink dark:bg-canvas-dark overflow-hidden min-h-[280px] md:min-h-full">
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div
                  className="absolute -top-24 -right-20 w-72 h-72 rounded-full blur-3xl opacity-40 bg-accent-glow"
                  aria-hidden
                />
                <div className="relative p-8 h-full flex flex-col justify-end text-canvas dark:text-ink-dark">
                  <Quote size={20} className="text-accent mb-3 opacity-80" />
                  <div className="text-[20px] md:text-[22px] font-medium leading-snug text-accent tracking-tight">
                    "{featured.summary.split('.')[0]}."
                  </div>
                  <div className="mt-5 text-[10.5px] font-mono uppercase tracking-[0.14em] text-white/40 dark:text-muted-dark">
                    Case · {featured.id.toUpperCase()} · two-quarter engagement
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherStories.map((s) => (
              <Link
                key={s.id}
                to={`/app/stories/${s.slug}`}
                className="group card p-5 hover:shadow-soft hover:border-line-strong dark:hover:border-line-strong-dark transition flex flex-col"
              >
                <div className="eyebrow">{s.industry}</div>
                <h4 className="mt-3 text-[17px] font-semibold tracking-tight leading-snug text-balance">
                  {s.title}
                </h4>
                <p className="mt-2 text-[13px] text-muted dark:text-muted-dark leading-relaxed line-clamp-3">
                  {s.summary}
                </p>
                <div className="mt-4 flex items-center gap-5 flex-wrap">
                  {s.metrics.slice(0, 3).map((m) => (
                    <div key={m.label}>
                      <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted dark:text-muted-dark font-medium">
                        {m.label}
                      </div>
                      <div className="text-[16px] font-semibold num mt-0.5 tracking-tight">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                  <span>{s.partner}</span>
                  <ArrowUpRight
                    size={13}
                    className="group-hover:text-accent transition"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-16 md:pt-24">
        <SectionHead
          eyebrow="Trusted by partners across APAC and beyond"
          title={
            <>
              The network{' '}
              <span className="text-accent">behind the yield.</span>
            </>
          }
          description={`${PARTNER_LOGOS.length} active partners across logic, memory, foundry services, and specialty — from Tuas to Hsinchu to Dresden.`}
        />

        <div className="mt-10 card relative overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-y divide-line/70 dark:divide-line-dark/70">
            {PARTNER_LOGOS.map((p) => {
              const Render = p.render
              return (
                <div
                  key={p.id}
                  className="group relative h-24 flex items-center justify-center px-4 transition"
                  title={`${p.name} · ${p.industry} · ${p.region}`}
                >
                  <Render className="h-6 w-auto text-muted dark:text-muted-dark group-hover:text-ink dark:group-hover:text-ink-dark transition" />
                  {p.tier === 'Strategic' && (
                    <span className="absolute top-2 left-2 text-[8.5px] font-mono uppercase tracking-[0.12em] text-accent-ink bg-accent px-1 rounded-sm">
                      Strategic
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">
          <div className="flex items-center gap-4">
            <TierDot label="Strategic" color="bg-accent" />
            <TierDot label="Preferred" color="bg-info" />
            <TierDot label="Ecosystem" color="bg-muted dark:bg-muted-dark" />
          </div>
          <Link
            to="/app/stories"
            className="text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark inline-flex items-center gap-1"
          >
            See every partner outcome <ArrowUpRight size={12} />
          </Link>
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-16 md:pt-24">
        <SectionHead
          eyebrow="Solutions — tuned to your industry"
          title={
            <>
              Pick the lane that{' '}
              <span className="text-accent">looks like yours.</span>
            </>
          }
          description="Each lane is a body of field-tested recipes, processes, and telemetry models. Browse by where your fab lives."
        />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              to="/app/services"
              className="group relative card p-5 hover:shadow-soft hover:border-line-strong dark:hover:border-line-strong-dark transition overflow-hidden"
            >
              <div
                className={clsx(
                  'absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition',
                  ind.tint,
                )}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="eyebrow">{ind.name}</div>
                  <ArrowUpRight
                    size={14}
                    className="text-faint dark:text-faint-dark group-hover:text-accent transition"
                  />
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <div className="text-[30px] font-semibold tracking-tightest num leading-none">
                    {ind.partnerCount}
                  </div>
                  <div className="text-[11px] text-muted dark:text-muted-dark font-mono uppercase tracking-[0.1em]">
                    partners
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-muted dark:text-muted-dark leading-relaxed text-pretty">
                  {ind.outcome}
                </p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {ind.signals.map((s) => (
                    <li
                      key={s}
                      className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-muted dark:text-muted-dark border border-line dark:border-line-dark rounded-sm px-1.5 py-0.5"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-16 md:pt-24">
        <div className="relative card-raised overflow-hidden bg-ink text-canvas dark:bg-surface-dark dark:text-ink-dark">
          <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
          <div
            className="absolute -top-32 -right-24 w-[380px] h-[380px] rounded-full blur-3xl opacity-25 bg-accent-glow"
            aria-hidden
          />
          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-6 p-8 md:p-12">
            <div className="md:col-span-3">
              <div className="eyebrow text-white/60 dark:text-muted-dark before:bg-white/30 dark:before:bg-muted-dark">
                Score calculator
              </div>
              <h3 className="mt-3 text-[32px] md:text-[40px] font-semibold tracking-tightest leading-[1.05] text-balance">
                Estimate your next{' '}
                <span className="text-accent">savings</span>{' '}
                in about 90 seconds.
              </h3>
              <p className="mt-4 text-[14.5px] text-white/70 dark:text-muted-dark max-w-xl leading-relaxed text-pretty">
                Pick a fab, a department, and the processes you want to co-tune. We'll model yield
                uplift, scrap reduction, downtime, and payback — grounded in the same methodology
                used in the case studies above.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/app/calculator" className="btn-accent">
                  <CalcIcon size={14} /> Open the calculator
                </Link>
                <Link
                  to="/app/docs/calculator-logic-sop"
                  className="btn border border-white/15 text-canvas hover:bg-white/5 dark:border-line-dark dark:text-ink-dark dark:hover:bg-raised-dark"
                >
                  How outputs are derived <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            <div className="md:col-span-2">
              <ul className="space-y-3 text-[13px] text-white/80 dark:text-muted-dark">
                {[
                  'Fab + department context (4 fabs, 5 departments seeded)',
                  'Process co-tuning with real compatibility rules',
                  'Excursion cost modelling',
                  'Payback in months, not guesses',
                ].map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
                    <span className="leading-snug">{pt}</span>
                  </li>
                ))}
              </ul>
              {latestResult && (
                <div className="mt-6 rounded-md border border-white/10 dark:border-line-dark p-3 bg-white/[0.02] dark:bg-raised-dark/40">
                  <div className="text-2xs font-mono uppercase tracking-[0.14em] text-white/50 dark:text-muted-dark">
                    Your last run
                  </div>
                  <div className="mt-1 text-[18px] font-semibold tracking-tight num">
                    {fmtUSD(latestResult.savingsAnnual)} / year
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/60 dark:text-muted-dark font-mono uppercase tracking-[0.1em]">
                    Score {latestResult.score} · {fmtRelative(latestResult.at)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-16 md:pt-24">
        <SectionHead
          eyebrow="Your workspace"
          title={
            <>
              What's moving on{' '}
              <span className="text-accent">your side this week.</span>
            </>
          }
          description="Personal to your account — tickets, invoices, and the things that need a nudge from you."
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card">
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
              {recentTickets.map((t) => (
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
          </div>

          <div className="space-y-5">
            <div className="card p-1">
              <div className="px-3 py-2.5 border-b border-line dark:border-line-dark">
                <div className="text-[12px] font-medium">Quick actions</div>
              </div>
              <ul>
                {[
                  { to: '/app/support/new', label: 'Submit a support request', icon: LifeBuoy },
                  { to: '/app/services', label: 'Request a service', icon: CalendarClock },
                  { to: '/app/docs', label: 'Browse knowledge base', icon: BookOpen },
                  { to: '/app/calculator', label: 'Run the calculator', icon: CalcIcon },
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
          </div>
        </div>
      </section>

      <section className="max-w-[1240px] mx-auto px-4 md:px-8 lg:px-10 pt-16 md:pt-24 pb-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-3">
            <div className="eyebrow">What's coming up</div>
            <h3 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-tightest leading-tight text-balance">
              Webinars, workshops, and release windows.
            </h3>

            <ul className="mt-6 card divide-hair">
              {PARTNER_EVENTS.map((ev) => (
                <li key={ev.id}>
                  <div className="flex items-start gap-4 px-4 py-4">
                    <div className="shrink-0 w-14 text-center">
                      <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted dark:text-muted-dark">
                        {ev.monthLabel}
                      </div>
                      <div className="text-[22px] font-semibold tracking-tight num leading-none mt-0.5">
                        {ev.dayLabel}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-accent-ink bg-accent px-1.5 py-0.5 rounded-sm">
                          {ev.kind}
                        </span>
                        <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">
                          {ev.location}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[14px] font-medium leading-snug text-balance">
                        {ev.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost text-[12px] h-7 px-2 shrink-0"
                      title={ev.cta}
                    >
                      {ev.cta} <ArrowUpRight size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <div className="eyebrow">Fresh in the knowledge base</div>
            <h3 className="mt-3 text-[24px] md:text-[28px] font-semibold tracking-tightest leading-tight text-balance">
              Latest SOPs and known issues.
            </h3>

            <ul className="mt-6 space-y-2">
              {topDocs.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/app/docs/${d.slug}`}
                    className="group block card p-4 hover:border-line-strong dark:hover:border-line-strong-dark transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-muted dark:text-muted-dark">
                        {d.category}
                      </span>
                      <span className="text-[10.5px] font-mono text-faint dark:text-faint-dark">
                        {d.readMin} min · {fmtRelative(d.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-2 text-[14px] font-medium leading-snug text-balance">
                      {d.title}
                    </div>
                    <div className="mt-1 text-[12.5px] text-muted dark:text-muted-dark line-clamp-2 leading-relaxed">
                      {d.excerpt}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-muted dark:text-muted-dark group-hover:text-accent transition">
                      <span>Read</span>
                      <ArrowUpRight size={12} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}


function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function SectionHead({
  eyebrow,
  title,
  description,
  cta,
}: {
  eyebrow: string
  title: ReactNode
  description?: string
  cta?: { label: string; to: string }
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div className="max-w-2xl">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-3 text-[28px] md:text-[36px] font-semibold tracking-tightest leading-[1.05] text-balance">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-[14.5px] text-muted dark:text-muted-dark leading-relaxed text-pretty">
            {description}
          </p>
        )}
      </div>
      {cta && (
        <Link
          to={cta.to}
          className="btn-outline shrink-0 self-start md:self-auto"
        >
          {cta.label} <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  )
}

function HeroStat({
  label,
  value,
  sub,
  icon: Icon,
  to,
}: {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  to: string
}) {
  return (
    <Link
      to={to}
      className="group relative p-5 bg-ink dark:bg-surface-dark hover:bg-[#0f1013] dark:hover:bg-raised-dark/60 transition"
    >
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50 dark:text-muted-dark">
          {label}
        </div>
        <Icon size={13} className="text-white/30 dark:text-faint-dark group-hover:text-accent transition" />
      </div>
      <div className="mt-3 text-[26px] font-semibold tracking-tightest num leading-none text-canvas dark:text-ink-dark">
        {value}
      </div>
      <div className="mt-2 text-[11px] text-white/50 dark:text-muted-dark leading-snug line-clamp-1">
        {sub}
      </div>
      <ArrowUpRight
        size={12}
        className="absolute bottom-3 right-3 text-white/30 dark:text-faint-dark opacity-0 group-hover:opacity-100 transition"
      />
    </Link>
  )
}

function TierDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx('w-1.5 h-1.5 rounded-full', color)} />
      {label}
    </span>
  )
}
