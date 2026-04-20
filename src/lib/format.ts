export function fmtUSD(n: number, opts: { cents?: boolean } = {}): string {
  const { cents = false } = opts
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
}

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtPercent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function fmtDate(iso: string | number | Date): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtDateTime(iso: string | number | Date): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function fmtRelative(iso: string | number | Date): string {
  const d = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.round((d - now) / 1000)
  const abs = Math.abs(diff)
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2592000, 'week'],
    [31536000, 'month'],
  ]
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (let i = 0; i < units.length; i++) {
    const [sec, unit] = units[i]
    if (abs < sec) {
      const prev = i === 0 ? 1 : units[i - 1][0]
      return rtf.format(Math.round(diff / prev), unit)
    }
  }
  return rtf.format(Math.round(diff / 31536000), 'year')
}
