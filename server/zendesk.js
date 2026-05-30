/**
 * Zendesk integration: ticket creation with retry/backoff, plus two-way sync
 * that pulls status + agent comments back into the local store. When Zendesk
 * credentials are absent every call degrades gracefully to a local-only mock.
 */

// Zendesk status -> portal status
const STATUS_IN = {
  new: 'open',
  open: 'open',
  pending: 'in_progress',
  hold: 'in_progress',
  solved: 'resolved',
  closed: 'closed',
}

// portal status -> Zendesk status
const STATUS_OUT = {
  open: 'open',
  in_progress: 'pending',
  resolved: 'solved',
  closed: 'closed',
}

const PRIORITY_OUT = { low: 'low', normal: 'normal', high: 'high', urgent: 'urgent' }

function credentials() {
  const subdomain = process.env.ZENDESK_SUBDOMAIN
  const email = process.env.ZENDESK_EMAIL
  const token = process.env.ZENDESK_API_TOKEN
  if (!subdomain || !email || !token) return null
  return {
    subdomain,
    authHeader: `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`,
  }
}

export function zendeskEnabled() {
  return credentials() !== null
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Retry an async fn with exponential backoff. */
export async function withRetry(fn, { retries = 3, baseDelay = 300, label = 'zendesk' } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < retries) {
        const delay = baseDelay * 2 ** attempt
        console.warn(`[${label}] attempt ${attempt + 1} failed (${error.message}); retrying in ${delay}ms`)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

async function zendeskFetch(creds, path, init) {
  const res = await fetch(`https://${creds.subdomain}.zendesk.com${path}`, {
    ...init,
    headers: {
      Authorization: creds.authHeader,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(payload?.error?.title || payload?.error || `Zendesk ${res.status}`)
  }
  return payload
}

/** Create a Zendesk ticket (with retry). Returns {mode, id}. */
export async function createZendeskTicket(ticket) {
  const creds = credentials()
  if (!creds) return { mode: 'mock', skipped: true }

  const firstMessage =
    ticket.messages?.find((m) => m.authorRole === 'you')?.body ?? ticket.subject

  const payload = await withRetry(
    () =>
      zendeskFetch(creds, '/api/v2/tickets.json', {
        method: 'POST',
        body: JSON.stringify({
          ticket: {
            external_id: ticket.id,
            subject: ticket.subject,
            comment: { body: firstMessage },
            priority: PRIORITY_OUT[ticket.priority] ?? undefined,
            status: STATUS_OUT[ticket.status] ?? undefined,
            tags: ['partner_portal', ...(ticket.tags ?? [])],
          },
        }),
      }),
    { label: 'zendesk:create' },
  )
  return { mode: 'zendesk', id: payload.ticket?.id ? String(payload.ticket.id) : null }
}

/** Push a new portal reply to Zendesk as a public comment (with retry). */
export async function addZendeskComment(zendeskId, body, author) {
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

/**
 * Pull a Zendesk ticket's current status and public comments back into a shape
 * the local store can merge. Returns null when unavailable.
 */
export async function syncZendeskTicket(zendeskId) {
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
    status: STATUS_IN[zt.status] ?? 'open',
    updatedAt: zt.updated_at,
    comments: (commentsRes.comments ?? []).map((c) => ({
      zendeskCommentId: String(c.id),
      body: c.body,
      public: c.public,
      authorId: String(c.author_id),
      createdAt: c.created_at,
    })),
  }
}
