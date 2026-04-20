const PREFIX = 'pp.'

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
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore quota errors in demo
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase()
  const t = Date.now().toString(36).slice(-4).toUpperCase()
  return prefix ? `${prefix}-${t}${r}` : `${t}${r}`
}
