import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BookOpen, ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react'
import { Card, StatCard, EmptyState } from './ui'
import { Badge } from './Badge'
import { Markdown } from './Markdown'
import type { SuccessStory } from '../lib/types'

const ALL = '__all__'

/** The browseable case studies: published only (drafts stay in admin management). */
export function publishedStories(stories: SuccessStory[]): SuccessStory[] {
  return stories.filter((s) => s.status === 'published')
}

/** Featured first, then most recently published. */
function byFeaturedThenRecent(a: SuccessStory, b: SuccessStory): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1
  return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)
}

/**
 * Search + industry filter + responsive card grid over a set of success stories.
 * Shared by the public marketing page and the in-portal browse page; `basePath`
 * decides where each card links ('/stories' vs '/app/stories').
 */
export function StoriesExplorer({ stories, basePath }: { stories: SuccessStory[]; basePath: string }) {
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState(ALL)

  const industries = useMemo(() => {
    const set = new Set<string>()
    for (const s of stories) if (s.industry) set.add(s.industry)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [stories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stories
      .filter((s) => {
        if (industry !== ALL && s.industry !== industry) return false
        if (!q) return true
        return [s.title, s.summary, s.partner, s.industry, s.region].some((v) => (v ?? '').toLowerCase().includes(q))
      })
      .sort(byFeaturedThenRecent)
  }, [stories, query, industry])

  const unfiltered = !query && industry === ALL

  return (
    <>
      {stories.length > 0 && (
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark" />
            <input
              className="input pl-9"
              placeholder="Search stories, partners, regions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search success stories"
            />
          </div>
          {industries.length > 0 && (
            <select
              className="select sm:w-56"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              aria-label="Filter by industry"
            >
              <option value={ALL}>All industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card mt-7">
          <EmptyState
            icon={<BookOpen size={28} />}
            title={stories.length === 0 ? 'No success stories yet' : 'No stories match your filters'}
            hint={
              stories.length === 0
                ? 'Check back soon — new partner case studies are published regularly.'
                : 'Try a different search term or industry.'
            }
          />
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((story) => (
            <StoryCard key={story.id} story={story} featured={story.featured && unfiltered} basePath={basePath} />
          ))}
        </div>
      )}
    </>
  )
}

function StoryCard({ story, featured, basePath }: { story: SuccessStory; featured: boolean; basePath: string }) {
  const meta = [story.partner, story.industry, story.region].filter(Boolean).join(' · ')
  return (
    <Link
      to={`${basePath}/${story.slug}`}
      className={`card group flex flex-col p-5 transition hover:shadow-lift hover:-translate-y-0.5 ${
        featured ? 'md:col-span-2 lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {featured ? <Badge tone="accent">Featured</Badge> : <span className="eyebrow">Case study</span>}
        <ArrowUpRight size={16} className="text-faint dark:text-faint-dark transition group-hover:text-emphasis shrink-0" />
      </div>

      <h2 className={`mt-3 font-semibold tracking-tight ${featured ? 'text-xl' : 'text-[17px]'}`}>{story.title}</h2>

      {story.summary && (
        <p className={`mt-2 text-sm text-muted dark:text-muted-dark ${featured ? '' : 'line-clamp-3'}`}>{story.summary}</p>
      )}

      {meta && <p className="mt-3 text-xs font-medium text-faint dark:text-faint-dark">{meta}</p>}

      {story.metricsJson.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line dark:border-line-dark flex flex-wrap gap-2">
          {story.metricsJson.slice(0, featured ? 4 : 3).map((m, i) => (
            <span key={i} className="inline-flex items-baseline gap-1.5 rounded-md bg-raised dark:bg-raised-dark px-2.5 py-1 text-xs">
              <span className="text-muted dark:text-muted-dark">{m.label}</span>
              <span className="num font-semibold text-emphasis">{m.value}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

/**
 * Full case-study article: metrics, before/after, body and related stories.
 * Shared by the public and in-portal detail pages; `basePath` drives the back
 * link and the "more stories" links. Renders no width wrapper — the caller sets
 * the reading column.
 */
export function StoryArticle({ story, stories, basePath }: { story: SuccessStory; stories: SuccessStory[]; basePath: string }) {
  const eyebrow = [story.industry, story.region].filter(Boolean).join(' · ')
  const hasComparison = story.beforeJson.length > 0 && story.afterJson.length > 0
  const related = stories.filter((s) => s.slug !== story.slug).slice(0, 2)

  return (
    <>
      <Link
        to={basePath}
        className="inline-flex items-center gap-1.5 text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-6"
      >
        <ArrowLeft size={14} /> Success stories
      </Link>

      {eyebrow && <p className="eyebrow text-emphasis mb-2">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight">{story.title}</h1>
      {story.summary && <p className="mt-3 text-base leading-relaxed text-muted dark:text-muted-dark">{story.summary}</p>}

      {story.metricsJson.length > 0 && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {story.metricsJson.map((m, i) => (
            <StatCard key={i} label={m.label} value={m.value} accent />
          ))}
        </div>
      )}

      {hasComparison && (
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          <Card eyebrow="Before" padded={false}>
            <dl className="p-5 divide-y divide-line dark:divide-line-dark">
              {story.beforeJson.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
                  <dt className="text-sm text-muted dark:text-muted-dark">{m.label}</dt>
                  <dd className="text-sm font-medium num">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card eyebrow="After Sigenic" padded={false}>
            <dl className="p-5 divide-y divide-line dark:divide-line-dark">
              {story.afterJson.map((m, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
                  <dt className="text-sm text-muted dark:text-muted-dark">{m.label}</dt>
                  <dd className="text-sm font-medium num text-emphasis">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {story.body && (
        <div className="mt-10">
          <Markdown source={story.body ?? ''} />
        </div>
      )}

      {story.partner && (
        <footer className="mt-10 pt-5 border-t border-line dark:border-line-dark text-sm text-muted dark:text-muted-dark">
          Partner · <span className="font-medium text-ink dark:text-ink-dark">{story.partner}</span>
        </footer>
      )}

      {related.length > 0 && (
        <section className="mt-14">
          <p className="eyebrow mb-4">More success stories</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {related.map((s) => (
              <Link key={s.id} to={`${basePath}/${s.slug}`} className="group">
                <Card className="h-full transition group-hover:border-accent/40">
                  {[s.industry, s.region].filter(Boolean).length > 0 && (
                    <p className="eyebrow text-emphasis mb-2">{[s.industry, s.region].filter(Boolean).join(' · ')}</p>
                  )}
                  <h3 className="text-[15px] font-semibold tracking-tight">{s.title}</h3>
                  {s.summary && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted dark:text-muted-dark line-clamp-2">{s.summary}</p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm text-emphasis">
                    Read story <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** Shared "story not found" state; `basePath` points the back link at the right index. */
export function StoryNotFound({ basePath }: { basePath: string }) {
  return (
    <EmptyState
      title="Story not found"
      hint="It may have been unpublished or the link is out of date."
      action={
        <Link to={basePath} className="btn-outline">
          Back to success stories
        </Link>
      }
    />
  )
}
