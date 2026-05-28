import { calculate } from './calculator'
import { load, saveLocalOnly } from './storage'
import {
  seedAnnouncements,
  seedCalc,
  seedDocs,
  seedInvoices,
  seedNotifications,
  seedOps,
  seedStories,
  seedTickets,
  seedUsers,
} from './seed'
import type { CalcConfig, CalcResult, CalcSelection, Ticket, User } from './types'

type BootstrapPayload = {
  users: User[]
  tickets: Ticket[]
  stories: unknown[]
  docs: unknown[]
  invoices: unknown[]
  calc: CalcConfig
  announcements: unknown[]
  notifications: unknown[]
  ops: unknown
  'calc.latest': unknown
}

const RESOURCE_FALLBACKS: BootstrapPayload = {
  users: seedUsers,
  tickets: seedTickets,
  stories: seedStories,
  docs: seedDocs,
  invoices: seedInvoices,
  calc: seedCalc,
  announcements: seedAnnouncements,
  notifications: seedNotifications,
  ops: seedOps,
  'calc.latest': null,
}

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed with ${res.status}`)
  }
  return body as T
}

export async function bootstrapData(): Promise<void> {
  const local = Object.fromEntries(
    Object.entries(RESOURCE_FALLBACKS).map(([key, fallback]) => [key, load(key, fallback)]),
  )
  const remote = await request<Record<string, unknown>>('/api/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ resources: local }),
  })
  for (const key of Object.keys(RESOURCE_FALLBACKS)) {
    if (key in remote) saveLocalOnly(key, remote[key])
  }
}

export async function loginWithApi(email: string, password: string): Promise<User> {
  const res = await request<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return res.user
}

export async function submitTicket(ticket: Ticket): Promise<Ticket> {
  const res = await request<{ ticket: Ticket }>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ ticket }),
  })
  return res.ticket
}

export async function calculateWithApi(cfg: CalcConfig, input: CalcSelection): Promise<CalcResult> {
  try {
    const res = await request<{ result: CalcResult }>('/api/calculate', {
      method: 'POST',
      body: JSON.stringify({ cfg, input }),
    })
    return res.result
  } catch {
    return calculate(cfg, input)
  }
}
