import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, BookOpen, ArrowUpRight } from 'lucide-react'
import { useData } from '../lib/data'
import { PageHeader } from '../components/PageHeader'
import { Card, Spinner, EmptyState, chipClass } from '../components/ui'
import { Badge } from '../components/Badge'
import { fmtRelative } from '../lib/format'
import { KB_CATEGORIES } from '../lib/constants'
import type { KnowledgeArticle } from '../lib/types'

export default function KnowledgeBase() {
  const { knowledgeArticles, ready } = useData()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string>('All')

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return knowledgeArticles.filter((a) => {
      if (category !== 'All' && a.category !== category) return false
      if (!needle) return true
      const haystack = [a.title, a.summary ?? '', ...(a.tagsJson ?? [])].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [knowledgeArticles, q, category])

  if (!ready) return <Spinner />

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base"
        title="Guides, FAQs & troubleshooting"
        description="Search Sigenic guides, frequently asked questions and troubleshooting notes for your team."
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex items-center gap-1 flex-wrap">
          {(['All', ...KB_CATEGORIES] as const).map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={chipClass(category === c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-8 w-64" placeholder="Search guides…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={18} />}
          title="No articles found"
          hint={q || category !== 'All' ? 'Try a different search term or category.' : 'No knowledge articles are available yet.'}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article }: { article: KnowledgeArticle }) {
  const reviewed = article.lastReviewedAt ?? article.updatedAt
  const tags = article.tagsJson ?? []

  return (
    <Link to={`/app/knowledge/${article.slug ?? article.id}`} className="group block">
      <Card className="h-full flex flex-col hover:shadow-soft transition">
        <div className="flex items-center gap-2 mb-2">
          {article.category && <Badge tone="accent">{article.category}</Badge>}
          <ArrowUpRight size={15} className="ml-auto text-faint group-hover:text-ink dark:group-hover:text-ink-dark transition" />
        </div>
        <div className="text-sm font-medium group-hover:text-emphasis">{article.title}</div>
        {article.summary && (
          <p className="mt-1 text-sm text-muted dark:text-muted-dark line-clamp-3">{article.summary}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-line dark:border-line-dark text-[11px] font-mono text-faint dark:text-faint-dark">
          Reviewed {fmtRelative(reviewed)}
        </div>
      </Card>
    </Link>
  )
}
