import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { load } from '../lib/storage'
import type { Doc } from '../lib/types'
import { seedDocs } from '../lib/seed'
import { fmtRelative } from '../lib/format'

export default function DocDetail() {
  const { slug } = useParams<{ slug: string }>()
  const docs = load<Doc[]>('docs', seedDocs)
  const doc = docs.find((d) => d.slug === slug)

  if (!doc) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <div className="text-[13px] font-mono text-muted dark:text-muted-dark">Doc not found</div>
        <Link to="/app/docs" className="btn-outline mt-4 inline-flex"><ArrowLeft size={12} /> Docs</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link to="/app/docs" className="inline-flex items-center gap-1 text-[12px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-6">
        <ArrowLeft size={12} /> Documentation
      </Link>
      <div className="eyebrow mb-3">{doc.category}</div>
      <h1 className="text-[34px] font-semibold tracking-tightest leading-tight text-balance">{doc.title}</h1>
      <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
        <span className="flex items-center gap-1"><Clock3 size={11} /> {doc.readMin} min read</span>
        <span>updated {fmtRelative(doc.updatedAt)}</span>
      </div>

      <article className="mt-10 text-[15.5px] leading-[1.75] text-ink dark:text-ink-dark whitespace-pre-wrap text-pretty">
        {doc.body}
      </article>
    </div>
  )
}
