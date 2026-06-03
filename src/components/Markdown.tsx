import { Fragment, type ReactNode } from 'react'
import { apiBase } from '../lib/api'

// Inline spans, tried in order: [text](url) link, **bold**, `code`, *italic*.
const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*/g

/** Bodies store portal/Notion assets as relative /api/... paths; prefix the API base
 *  so they resolve even when the frontend is served from another origin. */
function withApiBase(url: string): string {
  return url.startsWith('/api/') ? `${apiBase()}${url}` : url
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let key = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > i) out.push(text.slice(i, start))
    if (m[1] !== undefined) {
      out.push(
        <a
          key={key++}
          href={withApiBase(m[2])}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emphasis underline underline-offset-2 hover:opacity-80"
        >
          {m[1]}
        </a>,
      )
    } else if (m[3] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold text-ink dark:text-ink-dark">
          {m[3]}
        </strong>,
      )
    } else if (m[4] !== undefined) {
      out.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark font-mono text-[0.88em]"
        >
          {m[4]}
        </code>,
      )
    } else if (m[5] !== undefined) {
      out.push(
        <em key={key++} className="italic">
          {m[5]}
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

/** Split on blank lines, but keep fenced ``` code blocks intact (they may contain
 *  blank lines that would otherwise break the block apart). */
function splitBlocks(src: string): string[] {
  const out: string[] = []
  let buf: string[] = []
  let inCode = false
  const flush = () => {
    if (buf.length) out.push(buf.join('\n'))
    buf = []
  }
  for (const line of src.split('\n')) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        buf.push(line)
        flush()
        inCode = false
      } else {
        flush()
        inCode = true
        buf.push(line)
      }
      continue
    }
    if (inCode) buf.push(line)
    else if (line.trim() === '') flush()
    else buf.push(line)
  }
  flush()
  return out
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = splitBlocks(source.replace(/\r\n/g, '\n').trim())

  const rendered = blocks.map((block, bi) => {
    const trimmed = block.trim()

    if (trimmed.startsWith('```')) {
      const code = block.replace(/^[^\n]*\n?/, '').replace(/\n?```\s*$/, '')
      return (
        <pre
          key={bi}
          className="my-4 p-3.5 rounded-lg bg-raised dark:bg-raised-dark overflow-x-auto text-[13px] leading-relaxed"
        >
          <code className="font-mono">{code}</code>
        </pre>
      )
    }

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
      return (
        <figure key={bi} className="my-6">
          <img
            src={withApiBase(rawSrc)}
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

    if (lines.every((l) => /^>\s?/.test(l))) {
      const inner = lines.map((l) => l.replace(/^>\s?/, ''))
      return (
        <blockquote
          key={bi}
          className="my-4 border-l-2 border-line-strong dark:border-line-strong-dark pl-4 italic text-muted dark:text-muted-dark"
        >
          {inner.map((line, i) => (
            <Fragment key={i}>
              {renderInline(line)}
              {i < inner.length - 1 && <br />}
            </Fragment>
          ))}
        </blockquote>
      )
    }

    for (const { re, tag: Tag, marker } of LIST_KINDS) {
      const matches = lines.map((l) => re.exec(l))
      if (matches.every((m) => m !== null)) {
        return (
          <Tag
            key={bi}
            className={`${marker} my-4 pl-6 space-y-1.5 marker:text-muted dark:marker:text-muted-dark text-ink/90 dark:text-ink-dark/90 leading-[1.7]`}
          >
            {matches.map((m, i) => (
              <li key={i}>{renderInline(m![1])}</li>
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
