import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Search } from 'lucide-react'
import { load } from '../lib/storage'
import type { SuccessStory } from '../lib/types'
import { seedStories } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { fmtDate } from '../lib/format'

export default function Stories() {
  const [stories] = useState(() => load<SuccessStory[]>('stories', seedStories))
  const [q, setQ] = useState('')
  const [industry, setIndustry] = useState<string>('all')
  const industries = useMemo(() => Array.from(new Set(stories.map((s) => s.industry))), [stories])

  const { featured, rest } = useMemo(() => {
    const f = stories
      .filter((s) => (industry === 'all' ? true : s.industry === industry))
      .filter((s) =>
        q.trim() === '' ? true : (s.title + s.summary + s.partner).toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    const feat = f.find((s) => s.featured) ?? f[0]
    return { featured: feat, rest: f.filter((s) => s.id !== feat?.id) }
  }, [stories, q, industry])

  return (
    <div>
      <PageHeader
        eyebrow="Success stories · partner outcomes"
        title={
          <>
            Results, not <span className="text-accent">ambition.</span>
          </>
        }
        description="A living archive of measurable outcomes from partnerships across the APAC region. Each case includes the tools, processes, and payback economics."
      />

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stories…" className="input pl-9" />
        </div>
        <select aria-label="Industry filter" className="select w-[180px]" value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="all">All industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {featured && (
        <Link
          to={`/app/stories/${featured.slug}`}
          className="group block card-raised overflow-hidden mb-8 relative"
        >
          <div className="grid grid-cols-1 md:grid-cols-5">
            <div className="md:col-span-3 p-8 md:p-10 relative">
              <div className="eyebrow mb-4">Featured · {featured.industry}</div>
              <h2 className="text-[28px] md:text-[34px] font-semibold tracking-tightest leading-[1.08] text-balance">
                {featured.title}
              </h2>
              <p className="mt-4 text-[14.5px] text-muted dark:text-muted-dark text-pretty leading-relaxed max-w-xl">
                {featured.summary}
              </p>
              <div className="mt-6 flex items-center gap-5 flex-wrap">
                {featured.metrics.map((m) => (
                  <div key={m.label}>
                    <div className="text-2xs uppercase tracking-[0.12em] text-muted dark:text-muted-dark">{m.label}</div>
                    <div className="text-[22px] font-semibold tracking-tight num text-ink dark:text-ink-dark mt-0.5">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex items-center gap-2 text-[12px] text-muted dark:text-muted-dark font-mono uppercase tracking-[0.1em]">
                <span>{featured.partner}</span>
                <span className="opacity-40">·</span>
                <span>{featured.region}</span>
                <span className="opacity-40">·</span>
                <span>{fmtDate(featured.publishedAt)}</span>
              </div>
              <div className="absolute top-6 right-6 text-muted dark:text-muted-dark group-hover:text-accent transition">
                <ArrowUpRight size={18} />
              </div>
            </div>
            <div className="md:col-span-2 relative bg-ink dark:bg-surface-dark overflow-hidden min-h-[260px] md:min-h-full">
              <div className="absolute inset-0 bg-grid opacity-30" />
              <div
                className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-40"
                style={{ background: 'radial-gradient(circle, #CCFF00 0%, transparent 60%)' }}
              />
              <div className="relative p-8 h-full flex flex-col justify-end text-canvas dark:text-ink-dark">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                  Case · {featured.id.toUpperCase()}
                </div>
                <div className="mt-1 text-[22px] md:text-[24px] font-medium leading-snug text-accent tracking-tight">
                  "{featured.summary.split('.')[0]}."
                </div>
                <div className="mt-4 text-[11px] font-mono text-white/40">
                  Engagement · two quarters · ongoing
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rest.map((s) => (
          <Link
            key={s.id}
            to={`/app/stories/${s.slug}`}
            className="group card p-5 hover:shadow-soft hover:border-line-strong dark:hover:border-line-strong-dark transition flex flex-col"
          >
            <div className="eyebrow">{s.industry}</div>
            <h3 className="mt-3 text-[17px] font-semibold tracking-tight leading-snug text-balance">
              {s.title}
            </h3>
            <p className="mt-2 text-[13px] text-muted dark:text-muted-dark text-pretty leading-relaxed line-clamp-3">
              {s.summary}
            </p>
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              {s.metrics.slice(0, 3).map((m) => (
                <div key={m.label}>
                  <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted dark:text-muted-dark font-medium">{m.label}</div>
                  <div className="text-[16px] font-semibold num mt-0.5 tracking-tight">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4 flex items-center justify-between text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
              <span>{s.partner}</span>
              <ArrowUpRight size={13} className="text-faint dark:text-faint-dark group-hover:text-accent transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
