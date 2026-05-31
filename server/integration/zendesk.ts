/**
 * Zendesk integration: ticket creation with retry/backoff, plus two-way sync
 * that pulls status + agent comments back into the local store. When Zendesk
 * credentials are absent every call degrades gracefully to a local-only mock.
 */

// The portal stores the same status vocabulary as Zendesk, so syncing needs no
// translation — only a whitelist so unknown values fall back to a safe default.
const VALID_STATUSES = new Set(['new', 'open', 'pending', 'hold', 'solved', 'closed'])

const PRIORITY_OUT: Record<string, string> = { low: 'low', normal: 'normal', high: 'high', urgent: 'urgent' }

interface ZendeskCreds {
  subdomain: string
  authHeader: string
}

interface RetryableError extends Error {
  retryable?: boolean
  retryAfterMs?: number
}

function credentials(): ZendeskCreds | null {
  const subdomain = process.env.ZENDESK_SUBDOMAIN
  const email = process.env.ZENDESK_EMAIL
  const token = process.env.ZENDESK_API_TOKEN
  if (!subdomain || !email || !token) return null
  return {
    subdomain,
    authHeader: `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`,
  }
}

export function zendeskEnabled(): boolean {
  return credentials() !== null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Per-request ceiling (shared default for Zendesk + Notion fetches) so a hung
// connection can't stall a sync loop.
const REQUEST_TIMEOUT_MS = Number(process.env.ZENDESK_TIMEOUT_MS || 10000)

// Retry-After arrives in seconds; honour it (capped) over blind backoff.
function parseRetryAfter(value: string | null): number | undefined {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 30000) : undefined
}

/**
 * Retry an async fn with exponential backoff. Stops early on non-retryable
 * errors (4xx except 429) and honours a server-provided Retry-After delay.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 3, baseDelay = 300, label = 'zendesk' }: { retries?: number; baseDelay?: number; label?: string } = {},
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      if (error?.retryable === false) throw error
      if (attempt < retries) {
        const delay = error?.retryAfterMs ?? baseDelay * 2 ** attempt
        console.warn(`[${label}] attempt ${attempt + 1} failed (${error.message}); retrying in ${delay}ms`)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

/**
 * fetch() with a hard timeout and transient-error classification, shared by the
 * Zendesk and Notion integrations (Notion imports it). On a non-2xx response it
 * throws an Error tagged with the signals withRetry() reads: `retryable` (429 +
 * 5xx are transient; other 4xx are not) and, on 429, `retryAfterMs` honouring
 * the server's Retry-After header. Network failures and timeouts are retryable.
 * `parseError(payload, status)` turns the provider's error body into a message.
 */
export async function resilientFetch(
  url: string,
  init: RequestInit = {},
  { timeoutMs = REQUEST_TIMEOUT_MS, parseError }: { timeoutMs?: number; parseError?: (payload: any, status: number) => string } = {},
): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (error: any) {
    // Network failure or timeout — both transient, so worth a retry.
    const reason = error.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : error.message
    throw Object.assign(new Error(`request failed (${reason})`), { retryable: true } as RetryableError)
  } finally {
    clearTimeout(timer)
  }
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = parseError?.(payload, res.status) ?? `HTTP ${res.status}`
    // Retry only transient failures: 429 (rate limit) and 5xx (server). Other
    // 4xx are client errors that won't fix themselves on a second attempt.
    const retryable = res.status === 429 || res.status >= 500
    const retryAfterMs = res.status === 429 ? parseRetryAfter(res.headers.get('retry-after')) : undefined
    throw Object.assign(new Error(message), { retryable, retryAfterMs } as RetryableError)
  }
  return payload
}

async function zendeskFetch(creds: ZendeskCreds, path: string, init?: RequestInit): Promise<any> {
  return resilientFetch(
    `https://${creds.subdomain}.zendesk.com${path}`,
    {
      ...init,
      headers: {
        Authorization: creds.authHeader,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
    { parseError: (payload, status) => payload?.error?.title || payload?.error || `Zendesk ${status}` },
  )
}

interface TicketInput {
  id: string
  subject: string
  requester?: string
  requesterEmail?: string
  priority?: string
  status?: string
  tags?: string[]
  messages?: Array<{ authorRole?: string; body?: string }>
}

/** Create a Zendesk ticket (with retry). Returns {mode, id}. */
export async function createZendeskTicket(ticket: TicketInput): Promise<{ mode: string; id?: string | null; skipped?: boolean }> {
  const creds = credentials()
  if (!creds) return { mode: 'mock', skipped: true }

  const firstMessage = ticket.messages?.find((m) => m.authorRole === 'you')?.body ?? ticket.subject

  const payload = await withRetry(
    () =>
      zendeskFetch(creds, '/api/v2/tickets.json', {
        method: 'POST',
        body: JSON.stringify({
          ticket: {
            external_id: ticket.id,
            subject: ticket.subject,
            comment: { body: firstMessage },
            priority: ticket.priority ? PRIORITY_OUT[ticket.priority] ?? undefined : undefined,
            status: ticket.status && VALID_STATUSES.has(ticket.status) ? ticket.status : undefined,
            tags: ['partner_portal', ...(ticket.tags ?? [])],
          },
        }),
      }),
    { label: 'zendesk:create' },
  )
  return { mode: 'zendesk', id: payload.ticket?.id ? String(payload.ticket.id) : null }
}

/** Push a new portal reply to Zendesk as a public comment (with retry). */
export async function addZendeskComment(
  zendeskId: string | null | undefined,
  body: string,
  author: string,
): Promise<{ mode: string; ok?: boolean; skipped?: boolean }> {
  const creds = credentials()
  if (!creds || !zendeskId) return { mode: 'mock', skipped: true }
  await withRetry(
    () =>
      zendeskFetch(creds, `/api/v2/tickets/${zendeskId}.json`, {
        method: 'PUT',
        body: JSON.stringify({
          ticket: { comment: { body: `${author}: ${body}`, public: true } },
        }),
      }),
    { label: 'zendesk:comment' },
  )
  return { mode: 'zendesk', ok: true }
}

export interface ZendeskSyncResult {
  status: string
  updatedAt: string
  comments: Array<{ zendeskCommentId: string; body: string; public: boolean; authorId: string; createdAt: string }>
}

/**
 * Pull a Zendesk ticket's current status and public comments back into a shape
 * the local store can merge. Returns null when unavailable.
 */
export async function syncZendeskTicket(zendeskId: string | null | undefined): Promise<ZendeskSyncResult | null> {
  const creds = credentials()
  if (!creds || !zendeskId) return null
  const [ticketRes, commentsRes] = await Promise.all([
    withRetry(() => zendeskFetch(creds, `/api/v2/tickets/${zendeskId}.json`, { method: 'GET' }), {
      label: 'zendesk:get',
    }),
    withRetry(() => zendeskFetch(creds, `/api/v2/tickets/${zendeskId}/comments.json`, { method: 'GET' }), {
      label: 'zendesk:comments',
    }).catch(() => ({ comments: [] })),
  ])
  const zt = ticketRes.ticket
  if (!zt) return null
  return {
    status: VALID_STATUSES.has(zt.status) ? zt.status : 'open',
    updatedAt: zt.updated_at,
    comments: (commentsRes.comments ?? []).map((c: any) => ({
      zendeskCommentId: String(c.id),
      body: c.body,
      public: c.public,
      authorId: String(c.author_id),
      createdAt: c.created_at,
    })),
  }
}
