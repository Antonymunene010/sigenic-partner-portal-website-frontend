const PREFIX = 'pp.'

const SERVER_KEYS = new Set([
  'users',
  'tickets',
  'stories',
  'docs',
  'invoices',
  'calc',
  'calc.latest',
  'announcements',
  'notifications',
])

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
}

function syncResource(key: string, value: unknown) {
  if (!SERVER_KEYS.has(key) || typeof fetch !== 'function') return
  void fetch(`${apiBase()}/api/resources/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
    keepalive: JSON.stringify(value).length < 60000,
  }).catch(() => {
    /* backend is optional during local UI work */
  })
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  saveLocalOnly(key, value)
  syncResource(key, value)
}

export function saveLocalOnly<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* swallow quota errors */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* swallow */
  }
}

export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase()
  const t = Date.now().toString(36).slice(-4).toUpperCase()
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`
}

export function nextTicketId(): string {
  return 'TKT-' + String(Math.floor(242 + Math.random() * 700)).padStart(5, '0')
}
