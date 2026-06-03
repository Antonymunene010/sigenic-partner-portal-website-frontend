import { Fragment, type ReactNode } from 'react'
import { apiBase } from '../lib/api'

const INLINE_RE = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*/g

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let key = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > i) out.push(text.slice(i, start))
    if (m[1] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold text-ink dark:text-ink-dark">
          {m[1]}
        </strong>,
      )
    } else if (m[2] !== undefined) {
      out.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark font-mono text-[0.88em]"
        >
          {m[2]}
        </code>,
      )
    } else if (m[3] !== undefined) {
      out.push(
        <em key={key++} className="italic">
          {m[3]}
        </em>,
      )
    }
    i = start + m[0].length
  }
  if (i < text.length) out.push(text.slice(i))
  return out
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
const OL_ITEM_RE = /^\d+\.\s+(.*)$/
const UL_ITEM_RE = /^[-*]\s+(.*)$/

const HEADING_STYLES: Record<number, { tag: 'h2' | 'h3' | 'h4'; cls: string }> = {
  1: { tag: 'h2', cls: 'text-[22px] md:text-[24px] font-semibold tracking-tight mt-0 mb-4 text-ink dark:text-ink-dark' },
  2: { tag: 'h3', cls: 'text-[17px] font-semibold tracking-tight mt-8 mb-3 text-ink dark:text-ink-dark' },
}
const HEADING_FALLBACK = { tag: 'h4' as const, cls: 'text-[14px] font-semibold mt-6 mb-2 text-ink dark:text-ink-dark' }

const LIST_KINDS = [
  { re: OL_ITEM_RE, tag: 'ol', marker: 'list-decimal' },
  { re: UL_ITEM_RE, tag: 'ul', marker: 'list-disc' },
] as const

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').trim().split(/\n{2,}/)

  const rendered = blocks.map((block, bi) => {
    const trimmed = block.trim()

    const headingMatch = HEADING_RE.exec(trimmed)
    if (headingMatch) {
      const { tag: Tag, cls } = HEADING_STYLES[headingMatch[1].length] ?? HEADING_FALLBACK
      return (
        <Tag key={bi} className={cls}>
          {renderInline(headingMatch[2])}
        </Tag>
      )
    }

    const imageMatch = IMAGE_RE.exec(trimmed)
    if (imageMatch) {
      const [, alt, rawSrc] = imageMatch
      // Bodies store Notion images as a relative /api/... proxy path; prefix the API
      // base so it still resolves when the frontend is served from another origin.
      const src = rawSrc.startsWith('/api/') ? `${apiBase()}${rawSrc}` : rawSrc
      return (
        <figure key={bi} className="my-6">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="mx-auto max-w-full rounded-lg border border-line dark:border-line-dark"
          />
          {alt && (
            <figcaption className="mt-2 text-center text-xs text-muted dark:text-muted-dark">
              {alt}
            </figcaption>
          )}
        </figure>
      )
    }

    if (/^-{3,}$/.test(trimmed)) {
      return <hr key={bi} className="my-8 border-line dark:border-line-dark" />
    }

    const lines = block.split('\n')

    for (const { re, tag: Tag, marker } of LIST_KINDS) {
      if (lines.every((l) => re.test(l))) {
        return (
          <Tag
            key={bi}
            className={`${marker} my-4 pl-6 space-y-1.5 marker:text-muted dark:marker:text-muted-dark text-ink/90 dark:text-ink-dark/90 leading-[1.7]`}
          >
            {lines.map((l, i) => (
              <li key={i}>{renderInline(re.exec(l)![1])}</li>
            ))}
          </Tag>
        )
      }
    }

    return (
      <p key={bi} className="my-4 leading-[1.75] text-ink/90 dark:text-ink-dark/90">
        {lines.map((line, i) => (
          <Fragment key={i}>
            {renderInline(line)}
            {i < lines.length - 1 && <br />}
          </Fragment>
        ))}
      </p>
    )
  })

  return <div className={className}>{rendered}</div>
}
