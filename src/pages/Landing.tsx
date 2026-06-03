import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Calculator, BookOpen, Trophy, ArrowRight, ArrowUpRight } from 'lucide-react'
import { getPublicBundle } from '../lib/api'
import { PARTNER_LOGOS, INDUSTRIES } from '../lib/partners'
import { Card } from '../components/ui'
import { Badge } from '../components/Badge'
import type { SuccessStory } from '../lib/types'

const KPIS: { value: string; label: string }[] = [
  { value: '+38%', label: 'parametric yield lift' },
  { value: '4.1mo', label: 'median payback' },
  { value: '$2.4M', label: 'excursion losses avoided' },
]

const VALUE_PROPS: { icon: typeof LifeBuoy; title: string; body: string; to: string; cta: string }[] = [
  {
    icon: LifeBuoy,
    title: 'Self-service support',
    body: 'Raise support, demo and consultation requests that route straight into Zendesk — with status and threaded replies in one place.',
    to: '/contact',
    cta: 'Open a request',
  },
  {
    icon: Calculator,
    title: 'ROI calculator',
    body: 'Estimate yield, scrap and downtime savings for your machines and processes using Sigenic’s configurable scoring models.',
    to: '/calculator',
    cta: 'Run an estimate',
  },
  {
    icon: BookOpen,
    title: 'Knowledge base',
    body: 'Curated guides, integration playbooks and FAQs synced from Zendesk and Notion — searchable and always current.',
    to: '/login',
    cta: 'Browse the KB',
  },
  {
    icon: Trophy,
    title: 'Case studies',
    body: 'See how fabs across logic, memory and foundry segments turned co-tuning into measurable, audited outcomes.',
    to: '/stories',
    cta: 'Read the stories',
  },
]

export default function Landing() {
  const [stories, setStories] = useState<SuccessStory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getPublicBundle()
      .then((bundle) => {
        if (!active) return
        const featured = bundle.successStories.filter((s) => s.featured)
        setStories((featured.length ? featured : bundle.successStories).slice(0, 3))
      })
      .catch(() => {
        if (active) setStories([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line dark:border-line-dark">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-gold-gradient opacity-[0.07] blur-3xl"
        />
        <div className="relative max-w-[1180px] mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="eyebrow mb-4">Sigenic Care · Partner OS</div>
            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              The operating system for partner interactions with <span className="text-emphasis">Sigenic</span>
            </h1>
            <p className="mt-6 text-lg text-muted dark:text-muted-dark max-w-2xl leading-relaxed">
              One place for the Sigenic Care program: file support requests, model your cost savings with self-service ROI,
              and learn from the case studies of fabs already running with us.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/calculator" className="btn-accent">
                Try the ROI calculator <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-px rounded-lg overflow-hidden border border-line dark:border-line-dark bg-line dark:bg-line-dark max-w-2xl">
            {KPIS.map((k) => (
              <div key={k.label} className="bg-canvas dark:bg-canvas-dark px-5 py-5">
                <div className="text-3xl font-semibold tracking-tight num text-emphasis">{k.value}</div>
                <div className="mt-1 text-xs text-muted dark:text-muted-dark">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-[1180px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <div className="eyebrow mb-2">What you get</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Everything the partnership needs, in one portal</h2>
          <p className="mt-3 text-muted dark:text-muted-dark">
            Built around the four things partners reach for most — support, ROI proof, documentation and outcomes.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {VALUE_PROPS.map((p) => {
            const Icon = p.icon
            return (
              <Card key={p.title} className="flex flex-col">
                <div className="w-10 h-10 rounded-md bg-raised dark:bg-raised-dark flex items-center justify-center text-emphasis mb-4">
                  <Icon size={18} />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm text-muted dark:text-muted-dark leading-relaxed flex-1">{p.body}</p>
                <Link to={p.to} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emphasis hover:gap-1.5 transition-all">
                  {p.cta} <ArrowRight size={14} />
                </Link>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Logo wall */}
      <section className="border-y border-line dark:border-line-dark bg-raised/40 dark:bg-raised-dark/40">
        <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-14">
          <p className="text-center stat-label mb-8">Trusted across the APAC semiconductor ecosystem</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-10 items-center justify-items-center">
            {PARTNER_LOGOS.map((logo) => (
              <div
                key={logo.id}
                title={`${logo.name} · ${logo.industry}`}
                className="text-faint dark:text-faint-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
              >
                {logo.render({ className: 'h-7 w-auto' })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="max-w-[1180px] mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <div className="eyebrow mb-2">By segment</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Tuned for how your fab actually runs</h2>
          <p className="mt-3 text-muted dark:text-muted-dark">
            Scoring models and playbooks adapt to the dynamics of each segment — from 5nm logic to mature analog lines.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {INDUSTRIES.map((ind) => (
            <Card key={ind.slug} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className={`w-2.5 h-2.5 rounded-full ${ind.tint}`} />
                  <h3 className="text-[15px] font-semibold tracking-tight">{ind.name}</h3>
                </div>
                <Badge tone="neutral">{ind.partnerCount} partners</Badge>
              </div>
              <p className="mt-3 text-sm text-muted dark:text-muted-dark leading-relaxed">{ind.outcome}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {ind.signals.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] font-mono uppercase tracking-[0.08em] text-faint dark:text-faint-dark border border-line dark:border-line-dark rounded px-2 py-1"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured success stories */}
      <section className="border-t border-line dark:border-line-dark">
        <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-16 md:py-20">
          <div className="flex items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <div className="eyebrow mb-2">Proof, not promises</div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Featured success stories</h2>
            </div>
            <Link to="/stories" className="hidden sm:inline-flex btn-ghost text-sm shrink-0">
              All stories <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card p-5 h-48 animate-pulse" />
              ))}
            </div>
          ) : stories.length === 0 ? (
            <p className="text-sm text-muted dark:text-muted-dark">Success stories are on the way — check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map((story) => (
                <Link key={story.id} to={`/stories/${story.slug}`} className="card p-5 flex flex-col hover:shadow-soft transition group">
                  <div className="flex items-center gap-2 mb-3">
                    {story.industry && <Badge tone="neutral">{story.industry}</Badge>}
                    {story.region && <span className="text-[11px] font-mono text-faint dark:text-faint-dark">{story.region}</span>}
                  </div>
                  <h3 className="text-[15px] font-semibold tracking-tight group-hover:text-emphasis transition-colors">{story.title}</h3>
                  {story.summary && <p className="mt-2 text-sm text-muted dark:text-muted-dark leading-relaxed line-clamp-3 flex-1">{story.summary}</p>}
                  {story.metricsJson.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                      {story.metricsJson.slice(0, 2).map((m) => (
                        <div key={m.label}>
                          <div className="text-lg font-semibold tracking-tight num text-emphasis">{m.value}</div>
                          <div className="text-[11px] text-muted dark:text-muted-dark">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emphasis">
                    Read story <ArrowUpRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Closing CTA band */}
      <section className="px-4 md:px-8 pb-20">
        <div className="max-w-[1180px] mx-auto rounded-2xl bg-gold-gradient p-px">
          <div className="rounded-2xl bg-canvas dark:bg-canvas-dark px-6 md:px-12 py-12 md:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">See your numbers in minutes</h2>
              <p className="mt-3 text-muted dark:text-muted-dark">
                Bring a line and a process — get an ROI estimate in minutes and map the fastest path to a measurable win.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link to="/calculator" className="btn-accent">
                Try the calculator <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
