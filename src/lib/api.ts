import type {
  Announcement,
  CalcSelection,
  HydrateBundle,
  PublicBundle,
  RoiResult,
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
function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  })
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
export function publicCalculate(selection: CalcSelection): Promise<{ result: RoiResult }> {
  return request('/api/public/calculate', { method: 'POST', body: JSON.stringify({ selection }) })
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
export function hydrate(): Promise<HydrateBundle> {
  return request<HydrateBundle>('/api/hydrate')
}

/* ---------- calculator ---------- */
export function calculate(
  selection: CalcSelection,
  opts: { modelId?: string; save?: boolean } = {},
): Promise<{ result: RoiResult; run: import('./types').CalculatorRun | null }> {
  return request('/api/calculate', { method: 'POST', body: JSON.stringify({ selection, ...opts }) })
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

/* ---------- users ---------- */
export function createUserApi(user: Partial<User>, password?: string): Promise<{ user: User }> {
  return request('/api/users', { method: 'POST', body: JSON.stringify({ user, password }) })
}
export function updateUserApi(id: string, fields: Partial<User>, opts?: { touch?: boolean }): Promise<{ user: User }> {
  // touch: false tells the server not to bump updated_at (used by the status toggle).
  return request(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...fields, touch: opts?.touch }) })
}
export async function resetPasswordApi(id: string, password: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) })
}

/* ---------- generic admin resources ---------- */
export type ResourceName =
  | 'companies'
  | 'sites'
  | 'departments'
  | 'processes'
  | 'machines'
  | 'scoring-models'
  | 'scoring-rules'
  | 'financial-assumptions'
  | 'knowledge-articles'
  | 'success-stories'
  | 'invoices'

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
}): Promise<{ item: Announcement; recipients: number }> {
  return request('/api/announcements', { method: 'POST', body: JSON.stringify({ announcement }) })
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
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders(), ...(init.headers ?? {}) },
  })
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
