import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BookOpen, ArrowUpRight } from 'lucide-react'
import { getPublicBundle } from '../lib/api'
import { Spinner, EmptyState, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import type { SuccessStory } from '../lib/types'

const ALL = '__all__'

export default function PublicStories() {
  const { push } = useToast()
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<SuccessStory[]>([])
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState(ALL)

  useEffect(() => {
    let active = true
    getPublicBundle()
      .then((bundle) => {
        if (active) setStories(bundle.successStories)
      })
      .catch((err: unknown) => {
        if (active) push(err instanceof Error ? err.message : 'Could not load success stories', 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [push])

  const industries = useMemo(() => {
    const set = new Set<string>()
    for (const s of stories) if (s.industry) set.add(s.industry)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [stories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = stories.filter((s) => {
      if (industry !== ALL && s.industry !== industry) return false
      if (!q) return true
      return [s.title, s.summary, s.partner, s.industry, s.region]
        .some((v) => (v ?? '').toLowerCase().includes(q))
    })
    // Featured first, then most recently published.
    return matches.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)
    })
  }, [stories, query, industry])

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-10">
      <div className="max-w-2xl">
        <div className="eyebrow mb-2">Sigenic Care · Case studies</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Success <span className="text-emphasis">stories</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted dark:text-muted-dark">
          How semiconductor partners cut scrap, lift yield and shorten excursion detection with Sigenic.
          Explore measurable outcomes from fabs and OSATs across the region.
        </p>
      </div>

      {!loading && stories.length > 0 && (
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

      {loading ? (
        <Spinner label="Loading success stories…" />
      ) : filtered.length === 0 ? (
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
            <StoryCard key={story.id} story={story} featured={story.featured && !query && industry === ALL} />
          ))}
        </div>
      )}
    </div>
  )
}

function StoryCard({ story, featured }: { story: SuccessStory; featured: boolean }) {
  const meta = [story.partner, story.industry, story.region].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/stories/${story.slug}`}
      className={`card group flex flex-col p-5 transition hover:shadow-lift hover:-translate-y-0.5 ${
        featured ? 'md:col-span-2 lg:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {featured ? <Badge tone="accent">Featured</Badge> : <span className="eyebrow">Case study</span>}
        <ArrowUpRight
          size={16}
          className="text-faint dark:text-faint-dark transition group-hover:text-emphasis shrink-0"
        />
      </div>

      <h2 className={`mt-3 font-semibold tracking-tight ${featured ? 'text-xl' : 'text-[17px]'}`}>{story.title}</h2>

      {story.summary && (
        <p className={`mt-2 text-sm text-muted dark:text-muted-dark ${featured ? '' : 'line-clamp-3'}`}>
          {story.summary}
        </p>
      )}

      {meta && <p className="mt-3 text-xs font-medium text-faint dark:text-faint-dark">{meta}</p>}

      {story.metricsJson.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line dark:border-line-dark flex flex-wrap gap-2">
          {story.metricsJson.slice(0, featured ? 4 : 3).map((m, i) => (
            <span
              key={i}
              className="inline-flex items-baseline gap-1.5 rounded-md bg-raised dark:bg-raised-dark px-2.5 py-1 text-xs"
            >
              <span className="text-muted dark:text-muted-dark">{m.label}</span>
              <span className="num font-semibold text-emphasis">{m.value}</span>
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
