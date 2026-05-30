import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useData } from '../lib/data'
import { Card, Spinner, EmptyState } from '../components/ui'
import { Badge } from '../components/Badge'
import { Markdown } from '../components/Markdown'
import { fmtDate } from '../lib/format'

export default function ArticleDetail() {
  const { slug } = useParams()
  const { knowledgeArticles, ready } = useData()

  if (!ready) return <Spinner label="Loading article…" />

  const article =
    knowledgeArticles.find((a) => a.slug === slug) ?? knowledgeArticles.find((a) => a.id === slug)

  if (!article) {
    return (
      <Card>
        <EmptyState
          title="Article not found"
          hint="It may have been unpublished or moved."
          action={
            <Link to="/app/knowledge" className="btn-outline">
              Back to knowledge base
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="max-w-3xl">
      <Link
        to="/app/knowledge"
        className="inline-flex items-center gap-1.5 text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-4"
      >
        <ArrowLeft size={14} /> Knowledge base
      </Link>

      {article.category && <p className="eyebrow text-emphasis mb-2">{article.category}</p>}
      <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
      {article.summary && (
        <p className="mt-2 text-base leading-relaxed text-muted dark:text-muted-dark">{article.summary}</p>
      )}

      {article.tagsJson.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {article.tagsJson.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Markdown source={article.body ?? ''} />
      </div>

      <footer className="mt-10 pt-5 border-t border-line dark:border-line-dark text-xs text-faint">
        Last reviewed {fmtDate(article.lastReviewedAt ?? article.updatedAt)}
      </footer>
    </div>
  )
}
