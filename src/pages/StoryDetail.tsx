import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getPublicBundle } from '../lib/api'
import { Card, StatCard, EmptyState, Spinner } from '../components/ui'
import { Markdown } from '../components/Markdown'
import type { SuccessStory } from '../lib/types'

export default function StoryDetail() {
  const { slug } = useParams()
  const [stories, setStories] = useState<SuccessStory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getPublicBundle()
      .then((bundle) => {
        if (active) setStories(bundle.successStories)
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

  if (loading) return <Spinner label="Loading story…" />

  const story = stories.find((s) => s.slug === slug)

  if (!story) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <EmptyState
          title="Story not found"
          hint="It may have been unpublished or the link is out of date."
          action={
            <Link to="/stories" className="btn-outline">
              Back to success stories
            </Link>
          }
        />
      </div>
    )
  }

  const eyebrow = [story.industry, story.region].filter(Boolean).join(' · ')
  const hasComparison = story.beforeJson.length > 0 && story.afterJson.length > 0
  const related = stories.filter((s) => s.slug !== story.slug).slice(0, 2)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        to="/stories"
        className="inline-flex items-center gap-1.5 text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-6"
      >
        <ArrowLeft size={14} /> Success stories
      </Link>

      {eyebrow && <p className="eyebrow text-emphasis mb-2">{eyebrow}</p>}
      <h1 className="text-3xl font-semibold tracking-tight">{story.title}</h1>
      {story.summary && (
        <p className="mt-3 text-base leading-relaxed text-muted dark:text-muted-dark">{story.summary}</p>
      )}

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
              <Link key={s.id} to={`/stories/${s.slug}`} className="group">
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
    </div>
  )
}
