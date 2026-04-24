import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Clock3, Search } from 'lucide-react'
import { load } from '../lib/storage'
import type { Doc } from '../lib/types'
import { seedDocs } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { fmtRelative } from '../lib/format'
import { DOC_CATEGORY_ORDER as CATEGORY_ORDER } from '../lib/constants'

export default function Docs() {
  const [docs] = useState(() => load<Doc[]>('docs', seedDocs))
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const cats = useMemo(() => {
    const present = new Set(docs.map((d) => d.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [docs])

  const filtered = useMemo(() => {
    return docs
      .filter((d) => (cat === 'all' ? true : d.category === cat))
      .filter((d) => (q.trim() === '' ? true : (d.title + d.excerpt).toLowerCase().includes(q.toLowerCase())))
  }, [docs, q, cat])

  const grouped = useMemo(() => {
    const g: Record<string, Doc[]> = {}
    for (const d of filtered) {
      g[d.category] ??= []
      g[d.category].push(d)
    }
    return g
  }, [filtered])

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge base · self-service"
        title="FAQs, troubleshooting, SOPs, known issues."
        description="Every resolved issue becomes a reusable article. Search first — submit a ticket if you can’t find an answer."
      />

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark" />
          <input aria-label="Search knowledge base" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search FAQs, troubleshooting, SOPs…" className="input pl-9" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCat('all')}
            className={`px-2.5 h-8 text-[12px] rounded-md border ${
              cat === 'all'
                ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark'
                : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
            }`}
          >
            All
          </button>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-2.5 h-8 text-[12px] rounded-md border whitespace-nowrap ${
                cat === c
                  ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark'
                  : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(grouped).map(([c, list]) => (
        <section key={c} className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[18px] font-semibold tracking-tight">{c}</h2>
            <span className="text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
              {list.length} {list.length === 1 ? 'article' : 'articles'}
            </span>
          </div>
          <div className="card">
            <ul className="divide-hair">
              {list.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/app/docs/${d.slug}`}
                    className="flex items-start gap-4 px-4 py-3.5 hover:bg-raised/60 dark:hover:bg-raised-dark/60 transition group"
                  >
                    <BookOpen size={14} strokeWidth={1.75} className="mt-1 text-faint dark:text-faint-dark group-hover:text-emphasis transition" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-ink dark:text-ink-dark">{d.title}</div>
                      <div className="mt-1 text-[12.5px] text-muted dark:text-muted-dark leading-relaxed line-clamp-2">
                        {d.excerpt}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1"><Clock3 size={11} /> {d.readMin} min</span>
                        <span>updated {fmtRelative(d.updatedAt)}</span>
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="mt-1 opacity-0 group-hover:opacity-100 text-faint dark:text-faint-dark transition" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted dark:text-muted-dark text-[13px]">No docs match.</div>
      )}
    </div>
  )
}
