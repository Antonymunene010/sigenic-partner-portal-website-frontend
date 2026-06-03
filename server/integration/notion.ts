/**
 * Notion integration: pulls knowledge-base articles from a Notion database into
 * the local knowledge_articles cache (source_type='notion'). PRD §7.4/§8: content
 * can live in Notion while the portal still governs featured/category/audience/
 * approval. When credentials are absent every call degrades to a no-op mock, so
 * the portal keeps serving its locally-authored (source_type='portal') articles.
 *
 * Expected Notion database properties (case-insensitive, all optional except a
 * title): Title (title), Summary, Slug, Category, Tags (multi_select),
 * Audience (select: All/Customers/Distributors/Internal), Featured (checkbox),
 * Status (select: Published → active). Page body becomes the article body.
 */

import { withRetry, resilientFetch } from './zendesk'

const API = 'https://api.notion.com/v1'

interface NotionCreds {
  token: string
  databaseId: string
  version: string
}

/** A knowledge article mapped from a Notion page row, ready for the store to upsert. */
export interface NotionArticle {
  sourceRefId: string
  title: string
  summary: string | null
  slug: string
  category: string | null
  tags: string[]
  audienceType: string
  featured: boolean
  active: boolean
  lastReviewedAt: string | null
  body: string
}

function credentials(): NotionCreds | null {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_KB_DATABASE_ID
  if (!token || !databaseId) return null
  return {
    token,
    databaseId,
    version: process.env.NOTION_VERSION || '2022-06-28',
  }
}

export function notionEnabled(): boolean {
  return credentials() !== null
}

async function notionFetch(creds: NotionCreds, path: string, init?: RequestInit): Promise<any> {
  return resilientFetch(
    `${API}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Notion-Version': creds.version,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
    { parseError: (payload, status) => payload?.message || `Notion ${status}` },
  )
}

/* ----- property extraction ----- */

const plainText = (rich: Array<{ plain_text?: string }> | null | undefined): string =>
  (rich ?? []).map((r) => r.plain_text ?? '').join('')

/** Read a single Notion property into a plain JS value. */
function propValue(prop: any): any {
  if (!prop) return null
  switch (prop.type) {
    case 'title':
      return plainText(prop.title)
    case 'rich_text':
      return plainText(prop.rich_text)
    case 'select':
      return prop.select?.name ?? null
    case 'multi_select':
      return (prop.multi_select ?? []).map((o: any) => o.name)
    case 'checkbox':
      return prop.checkbox
    case 'date':
      return prop.date?.start ?? null
    case 'url':
      return prop.url ?? null
    default:
      return null
  }
}

/** Look up a property by name, case-insensitively. */
function prop(props: Record<string, any>, name: string): any {
  const key = Object.keys(props).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? propValue(props[key]) : null
}

/** The title column is marked type==='title' regardless of its name (e.g. 「名称」). */
function titleValue(props: Record<string, any>): string | null {
  const entry = Object.values(props).find((p: any) => p?.type === 'title')
  return entry ? plainText((entry as any).title) : null
}

const AUDIENCE: Record<string, string> = {
  all: 'all',
  customer: 'customer',
  customers: 'customer',
  distributor: 'distributor',
  distributors: 'distributor',
  internal: 'internal',
}
const normAudience = (v: unknown): string => AUDIENCE[String(v ?? 'all').toLowerCase()] ?? 'all'

/** Status select → active flag. Published/live/approved means surfaced. */
const PUBLISHED = new Set(['published', 'live', 'active', 'approved'])
const normActive = (status: unknown): boolean => (status == null ? true : PUBLISHED.has(String(status).toLowerCase()))

const slugify = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

/* ----- page body → markdown-ish text ----- */

function blocksToText(blocks: any[] | null | undefined): string {
  const lines: string[] = []
  for (const b of blocks ?? []) {
    const data = b[b.type]
    const text = data?.rich_text ? plainText(data.rich_text) : ''
    switch (b.type) {
      case 'heading_1':
        lines.push(`# ${text}`)
        break
      case 'heading_2':
        lines.push(`## ${text}`)
        break
      case 'heading_3':
        lines.push(`### ${text}`)
        break
      case 'bulleted_list_item':
        lines.push(`- ${text}`)
        break
      case 'numbered_list_item':
        lines.push(`1. ${text}`)
        break
      case 'to_do':
        lines.push(`- [${data.checked ? 'x' : ' '}] ${text}`)
        break
      case 'quote':
        lines.push(`> ${text}`)
        break
      case 'code':
        lines.push('```\n' + text + '\n```')
        break
      case 'image': {
        // Image blocks carry no rich_text. "external" images have a stable URL;
        // Notion-hosted "file" images expose a short-lived signed S3 URL (~1h), so
        // we store a stable proxy path and resolve the live URL on demand (see
        // getNotionImageUrl + the /api/notion/image/:blockId route).
        const src = data?.type === 'external' ? data.external?.url : `/api/notion/image/${b.id}`
        const caption = data?.caption ? plainText(data.caption) : ''
        if (src) lines.push(`![${caption}](${src})`)
        break
      }
      default:
        if (text) lines.push(text)
    }
  }
  return lines.join('\n\n')
}

async function fetchPageBody(creds: NotionCreds, pageId: string): Promise<string> {
  const res = await withRetry(
    () => notionFetch(creds, `/blocks/${pageId}/children?page_size=100`, { method: 'GET' }),
    { label: 'notion:blocks' },
  ).catch(() => null)
  return res ? blocksToText(res.results) : ''
}

/* ----- image proxy: resolve a Notion-hosted image to a live URL ----- */

interface CachedImageUrl {
  url: string
  expiresAt: number
}

// Signed Notion file URLs are short-lived (~1h). Cache the resolved URL until just
// before it expires so a page full of images doesn't hammer the Notion API.
const imageUrlCache = new Map<string, CachedImageUrl>()

/**
 * Resolve a single Notion image block to a currently-valid image URL. Article
 * bodies store a stable proxy path (/api/notion/image/:blockId) for Notion-hosted
 * images; the proxy calls this to fetch a fresh signed URL on demand. Returns null
 * when Notion is unconfigured, the block is missing, or it is not an image block.
 */
export async function getNotionImageUrl(blockId: string): Promise<string | null> {
  const cached = imageUrlCache.get(blockId)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const creds = credentials()
  if (!creds) return null

  const block = await withRetry(
    () => notionFetch(creds, `/blocks/${blockId}`, { method: 'GET' }),
    { label: 'notion:block' },
  ).catch(() => null)
  if (!block || block.type !== 'image') return null

  const img = block.image
  const url: string | null =
    img?.type === 'external' ? (img.external?.url ?? null) : (img?.file?.url ?? null)
  if (!url) return null

  // file.expiry_time is an ISO timestamp; external images don't expire. Refresh a
  // minute early so we never hand out a URL that dies mid-request.
  const raw = img?.file?.expiry_time ? Date.parse(img.file.expiry_time) : NaN
  const expiresAt = Number.isFinite(raw) ? raw - 60_000 : Date.now() + 3_600_000
  imageUrlCache.set(blockId, { url, expiresAt })
  return url
}

/** The resolved title of a page row, or '' for an empty (draft) row. */
function pageTitle(page: any): string {
  const props = page.properties ?? {}
  return (titleValue(props) || prop(props, 'Title') || prop(props, 'Name') || '').trim()
}

/** Map one Notion page (row) to a knowledge-article shape the store can upsert. */
function pageToArticle(page: any, body: string): NotionArticle {
  const props = page.properties ?? {}
  const title = pageTitle(page) || 'Untitled'
  return {
    sourceRefId: page.id,
    title,
    summary: prop(props, 'Summary') ?? null,
    slug: prop(props, 'Slug') || slugify(title),
    category: prop(props, 'Category') ?? null,
    tags: prop(props, 'Tags') ?? [],
    audienceType: normAudience(prop(props, 'Audience')),
    featured: Boolean(prop(props, 'Featured')),
    active: normActive(prop(props, 'Status')),
    lastReviewedAt: page.last_edited_time ?? null,
    body,
  }
}

/**
 * Pull every page in the configured Notion KB database, with bodies. Returns an
 * empty array when Notion is not configured. Handles pagination.
 */
export async function fetchNotionArticles(): Promise<NotionArticle[]> {
  const creds = credentials()
  if (!creds) return []

  const pages: any[] = []
  let cursor: string | undefined
  do {
    const payload = await withRetry(
      () =>
        notionFetch(creds, `/databases/${creds.databaseId}/query`, {
          method: 'POST',
          body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
        }),
      { label: 'notion:query' },
    )
    pages.push(...(payload.results ?? []))
    cursor = payload.has_more ? payload.next_cursor : undefined
  } while (cursor)

  const articles: NotionArticle[] = []
  for (const page of pages) {
    if (!pageTitle(page)) continue // skip empty draft rows
    const body = await fetchPageBody(creds, page.id)
    articles.push(pageToArticle(page, body))
  }
  return articles
}
