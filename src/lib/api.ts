import type {
  Announcement,
  CalcAdditionalInfo,
  CalcSelection,
  HydrateBundle,
  PublicBundle,
  RiskResult,
  ServiceRequest,
  User,
} from './types'

const TOKEN_KEY = 'pp.token'

export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as string) : null
  } catch {
    return null
  }
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
}
/** Prefix relative `/api/...` paths with apiBase() so they resolve cross-origin;
 *  pass-through for absolute URLs (https, data:, blob:, Notion proxy, etc.). */
export function withApiBase(url: string): string {
  return url.startsWith('/api/') ? `${apiBase()}${url}` : url
}
function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// The auth session can expire while the app is open (login tokens are time-boxed).
// `request()` lives outside React, so it can't call useAuth().logout directly —
// instead AuthProvider registers a handler here, which we fire on any 401 so the
// expired session is cleared and the router bounces to /login (rather than every
// in-app action surfacing a raw "Authentication required." toast).
let authExpiredHandler: (() => void) | null = null
export function onAuthExpired(handler: (() => void) | null): void {
  authExpiredHandler = handler
}

// Every fetch entry point (request, uploadAttachment, downloadPdf) routes its
// Response through here so an expired session is handled the same way everywhere.
// A 401 only counts as a session expiry once we hold a token: the server sent it
// back rejected (expired/invalid). The login call's own 401 (bad credentials) has
// no token yet, so it falls through untouched.
function checkAuth(res: Response): Response {
  if (res.status === 401 && getToken()) {
    clearToken()
    authExpiredHandler?.()
  }
  return res
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = checkAuth(
    await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
    }),
  )
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed with ${res.status}`)
  return body as T
}

/* ---------- public (no auth) ---------- */
export function getPublicBundle(): Promise<PublicBundle> {
  return request<PublicBundle>('/api/public')
}
export function submitPublicRequest(req: {
  contactName: string
  contactEmail: string
  title: string
  description?: string
  requestType?: 'demo' | 'consultation'
  interestType?: string
}): Promise<{ item: { id: string; status: string } }> {
  return request('/api/public/requests', { method: 'POST', body: JSON.stringify({ request: req }) })
}
/* ---------- auth ---------- */
export function loginWithApi(email: string, password: string): Promise<{ user: User; token: string }> {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}
export function getMe(): Promise<{ user: User }> {
  return request('/api/auth/me')
}
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
}
export async function requestPasswordReset(email: string): Promise<void> {
  await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: newPassword }) })
}

/* ---------- self-service sign-up (public) ---------- */
export interface SignupCompanyChoice {
  id: string
  companyName: string
  companyType: 'distributor' | 'customer'
}
export function getSignupCompanies(): Promise<{ companies: SignupCompanyChoice[] }> {
  return request('/api/auth/companies')
}
export interface SignupPayload {
  fullName: string
  email: string
  companyId?: string
  newCompany?: {
    companyName: string
    companyType: 'distributor' | 'customer'
    country?: string
    website?: string
  }
}
export async function signup(payload: SignupPayload): Promise<{ ok: true }> {
  return request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) })
}

export function approveUserApi(id: string, opts: { role?: string } = {}): Promise<{ user: User }> {
  return request(`/api/users/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify(opts) })
}
export function rejectUserApi(id: string, opts: { reason?: string } = {}): Promise<{ ok: true }> {
  return request(`/api/users/${encodeURIComponent(id)}/reject`, { method: 'POST', body: JSON.stringify(opts) })
}

export function hydrate(): Promise<HydrateBundle> {
  return request<HydrateBundle>('/api/hydrate')
}

/* ---------- calculator ---------- */
// Stateless preview — does not persist. Used by Step 2 of the wizard.
export function calculate(
  selection: CalcSelection,
  opts: { modelId?: string } = {},
): Promise<{ result: RiskResult }> {
  return request('/api/calculate', { method: 'POST', body: JSON.stringify({ selection, ...opts }) })
}
/** Final wizard submit for authenticated users — persists + emails admins. */
export function submitCalculation(
  selection: CalcSelection,
  opts: { additional?: CalcAdditionalInfo; clientName?: string; modelId?: string } = {},
): Promise<{ result: RiskResult; runId: string; submittedAt: string }> {
  return request('/api/calculator/submit', { method: 'POST', body: JSON.stringify({ selection, ...opts }) })
}

/* ---------- service requests ---------- */
export function createServiceRequest(req: Partial<ServiceRequest> & { requestType: string; title: string }): Promise<{ item: ServiceRequest }> {
  return request('/api/service-requests', { method: 'POST', body: JSON.stringify({ request: req }) })
}
export function addServiceRequestMessage(id: string, body: string): Promise<{ item: ServiceRequest }> {
  return request(`/api/service-requests/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body }) })
}
export function updateServiceRequest(id: string, fields: Partial<ServiceRequest>): Promise<{ item: ServiceRequest }> {
  return request(`/api/service-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ item: fields }) })
}
export function syncRequests(): Promise<{ synced: number; mode?: string }> {
  return request('/api/service-requests/sync', { method: 'POST' })
}

/* ---------- knowledge base ---------- */
export function syncKnowledge(): Promise<{ synced: number; mode?: string }> {
  return request('/api/knowledge/sync', { method: 'POST' })
}

/* ---------- attachments (rich-text article images/files) ---------- */
export interface UploadedAsset {
  id: string
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
}
/** Upload one file as a raw body; returns a stable /api/attachments/:id URL to embed. */
export async function uploadAttachment(file: File): Promise<UploadedAsset> {
  const res = checkAuth(
    await fetch(`${apiBase()}/api/attachments?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', ...authHeaders() },
      body: file,
    }),
  )
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`)
  return body as UploadedAsset
}

/* ---------- users ---------- */
export function createUserApi(user: Partial<User>, password?: string): Promise<{ user: User }> {
  return request('/api/users', { method: 'POST', body: JSON.stringify({ user, password }) })
}
export function updateUserApi(id: string, fields: Partial<User>, opts?: { touch?: boolean }): Promise<{ user: User }> {
  // touch: false tells the server not to bump updated_at (used by the status toggle).
  return request(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...fields, touch: opts?.touch }) })
}
export async function resetPasswordApi(id: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' })
}
export async function resendInviteApi(id: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(id)}/resend-invite`, { method: 'POST' })
}
export function deleteUserApi(id: string): Promise<{ ok: boolean }> {
  return request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------- generic admin resources ---------- */
export type ResourceName =
  | 'companies'
  | 'sites'
  | 'departments'
  | 'processes'
  | 'machines'
  | 'scoring-models'
  | 'calculator-issues'
  | 'occurrence-options'
  | 'detection-options'
  | 'technology-prices'
  | 'knowledge-articles'
  | 'success-stories'
  | 'invoices'
  | 'request-types'
  | 'request-departments'
  | 'request-processes'
  | 'request-machines'

export function createResource<T>(resource: ResourceName, item: Partial<T>): Promise<{ item: T }> {
  return request(`/api/${resource}`, { method: 'POST', body: JSON.stringify({ item }) })
}
export function updateResource<T>(
  resource: ResourceName,
  id: string,
  item: Partial<T>,
  opts?: { touch?: boolean },
): Promise<{ item: T }> {
  // touch: false tells the server not to bump updated_at (used by inline status toggles).
  return request(`/api/${resource}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ item, touch: opts?.touch }) })
}
export function deleteResource(resource: ResourceName, id: string): Promise<{ ok: boolean }> {
  return request(`/api/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------- scoring ---------- */
export function activateScoringModel(id: string): Promise<{ item: import('./types').ScoringModel }> {
  return request(`/api/scoring-models/${encodeURIComponent(id)}/activate`, { method: 'POST' })
}

/* ---------- announcements ---------- */
export function publishAnnouncement(announcement: {
  title: string
  body: string
  audienceType?: string
  pinned?: boolean
  expireAt?: string | null
}): Promise<{ item: Announcement; recipients: number }> {
  return request('/api/announcements', { method: 'POST', body: JSON.stringify({ announcement }) })
}
export function updateAnnouncement(
  id: string,
  item: Partial<Pick<Announcement, 'title' | 'body' | 'audienceType' | 'pinned' | 'expireAt' | 'active'>>,
): Promise<{ item: Announcement }> {
  return request(`/api/announcements/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ item }) })
}
export function deleteAnnouncement(id: string): Promise<{ ok: boolean }> {
  return request(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ---------- notifications ---------- */
export async function markNotificationRead(id: string): Promise<void> {
  await request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
}
export async function markAllNotificationsRead(): Promise<void> {
  await request('/api/notifications/read-all', { method: 'POST' })
}

/* ---------- analytics + emails ---------- */
export function getAnalytics(): Promise<Record<string, unknown>> {
  return request('/api/analytics')
}

/* ---------- PDF downloads ---------- */
async function downloadPdf(path: string, init: RequestInit, filename: string): Promise<void> {
  const res = checkAuth(
    await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders(), ...(init.headers ?? {}) },
    }),
  )
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
export function downloadInvoicePdf(id: string): Promise<void> {
  return downloadPdf(`/api/invoices/${encodeURIComponent(id)}/pdf`, { method: 'GET' }, `${id}.pdf`)
}
export function downloadReportPdf(report: unknown, estimateId: string): Promise<void> {
  return downloadPdf('/api/reports/calculation', { method: 'POST', body: JSON.stringify({ report }) }, `${estimateId}.pdf`)
}
