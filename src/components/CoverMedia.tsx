import { AlertTriangle, BookOpen, HelpCircle, ListChecks, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import { withApiBase } from '../lib/api'
import type { KnowledgeArticle } from '../lib/types'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  FAQs: HelpCircle,
  Troubleshooting: Wrench,
  'Best Practices': Sparkles,
  'Known Issues': AlertTriangle,
  SOPs: ListChecks,
}

const MD_IMAGE = /!\[[^\]]*\]\(([^)\s]+)/

function firstBodyImage(body: string | null | undefined): string | null {
  if (!body) return null
  const m = body.match(MD_IMAGE)
  return m ? m[1] : null
}

// Stable hue from title so each article gets its own swatch on the grid; small
// rotation between stops keeps the gradient from going flat.
function hueFromString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h % 360
}

type ArticleCoverInput = Pick<KnowledgeArticle, 'title' | 'category' | 'body' | 'coverImageId'>

/**
 * Cover image for a knowledge article. Resolves in three steps:
 *  1. admin-picked `coverImageId` → /api/attachments/:id
 *  2. first `![](url)` found in the markdown body (incl. Notion proxy urls)
 *  3. generated tile (title-hashed gradient + category icon) so the grid never
 *     has bald white cards even when authors skip the cover slot.
 */
export function CoverMedia({ article, className = '' }: { article: ArticleCoverInput; className?: string }) {
  const src = article.coverImageId
    ? `/api/attachments/${encodeURIComponent(article.coverImageId)}`
    : firstBodyImage(article.body)

  if (src) {
    return <img src={withApiBase(src)} alt="" className={`w-full h-full object-cover ${className}`} loading="lazy" />
  }

  const hue = hueFromString(article.title)
  const Icon = (article.category && CATEGORY_ICON[article.category]) || BookOpen
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 55%), hsl(${(hue + 40) % 360} 70% 42%))` }}
      aria-hidden
    >
      <Icon size={40} strokeWidth={1.5} className="text-white/85" />
    </div>
  )
}
