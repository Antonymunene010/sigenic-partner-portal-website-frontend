import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { load } from '../lib/storage'
import type { SuccessStory } from '../lib/types'
import { seedStories } from '../lib/seed'
import { fmtDate } from '../lib/format'

export default function StoryDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [stories] = useState(() => load<SuccessStory[]>('stories', seedStories))
  const story = stories.find((s) => s.slug === slug)
  const others = useMemo(() => (story ? stories.filter((s) => s.id !== story.id).slice(0, 3) : []), [stories, story])
  if (!story) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <div className="text-[13px] font-mono text-muted dark:text-muted-dark">Story not found</div>
        <Link to="/app/stories" className="btn-outline mt-4 inline-flex"><ArrowLeft size={12} /> Back to stories</Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/app/stories" className="inline-flex items-center gap-1 text-[12px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-6">
        <ArrowLeft size={12} /> Success stories
      </Link>

      <header className="mb-8 max-w-3xl">
        <div className="eyebrow mb-4">{story.industry} · {story.region}</div>
        <h1 className="text-[36px] md:text-[46px] leading-[1.03] font-semibold tracking-tightest text-balance">
          {story.title}
        </h1>
        <p className="mt-5 text-[16px] md:text-[17px] text-muted dark:text-muted-dark text-pretty leading-relaxed">
          {story.summary}
        </p>
        <div className="mt-6 flex items-center gap-2 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
          <span>{story.partner}</span>
          <span>·</span>
          <span>{fmtDate(story.publishedAt)}</span>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {story.metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <div className="stat-label">{m.label}</div>
            <div className="mt-3 text-[32px] font-semibold tracking-tightest num leading-none">
              {m.value}
            </div>
          </div>
        ))}
        <div className="card p-5 bg-ink text-canvas dark:bg-surface-dark dark:text-ink-dark relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="relative">
            <div className="text-2xs uppercase tracking-[0.12em] text-white/50 dark:text-muted-dark">Engagement</div>
            <div className="mt-3 font-serif italic text-[24px] leading-tight text-accent">ongoing</div>
            <div className="mt-2 text-[11px] font-mono text-white/40 dark:text-faint-dark uppercase tracking-[0.1em]">
              Renews quarterly
            </div>
          </div>
        </div>
      </section>

      <article className="max-w-2xl prose-custom text-[15.5px] leading-relaxed text-ink dark:text-ink-dark">
        <p className="text-pretty whitespace-pre-wrap">{story.body}</p>
      </article>

      <section className="mt-16 pt-8 border-t border-line dark:border-line-dark">
        <div className="eyebrow mb-4">More stories</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {others.map((s) => (
            <Link key={s.id} to={`/app/stories/${s.slug}`} className="card p-4 hover:border-line-strong dark:hover:border-line-strong-dark transition group">
              <div className="text-[10px] uppercase tracking-[0.12em] text-faint dark:text-faint-dark font-mono">{s.industry}</div>
              <div className="mt-2 text-[14px] font-medium leading-snug text-balance">{s.title}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                <span>{s.partner}</span>
                <ArrowUpRight size={12} className="group-hover:text-accent transition" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
