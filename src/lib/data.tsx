import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { hydrate, getToken } from './api'
import { useAuth } from './auth'
import type { HydrateBundle } from './types'

const EMPTY: HydrateBundle = {
  me: null,
  company: null,
  companies: [],
  sites: [],
  users: [],
  departments: [],
  processes: [],
  machines: [],
  scoringModels: [],
  calculatorIssues: [],
  occurrenceOptions: [],
  detectionOptions: [],
  technologyPrices: [],
  activeScoringModelId: null,
  calculatorRuns: [],
  serviceRequests: [],
  knowledgeArticles: [],
  successStories: [],
  announcements: [],
  invoices: [],
  notifications: [],
  auditLogs: [],
}

interface DataCtx extends HydrateBundle {
  ready: boolean
  error: string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [bundle, setBundle] = useState<HydrateBundle>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setBundle(EMPTY)
      setReady(true)
      return
    }
    try {
      const data = await hydrate()
      setBundle(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setReady(true)
    }
  }, [])

  // Re-hydrate whenever the authenticated user changes (login / logout).
  useEffect(() => {
    setReady(false)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return <Ctx.Provider value={{ ...bundle, ready, error, refresh }}>{children}</Ctx.Provider>
}

export function useData(): DataCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}

/* convenience lookups */
export function useLookups() {
  const { departments, processes, machines, scoringModels, companies, sites, users } = useData()
  return {
    departmentName: (id?: string | null) => departments.find((d) => d.id === id)?.name ?? '—',
    processName: (id?: string | null) => processes.find((p) => p.id === id)?.processName ?? '—',
    machineName: (id?: string | null) => machines.find((m) => m.id === id)?.machineName ?? '—',
    scoringModelName: (id?: string | null) => scoringModels.find((m) => m.id === id)?.versionName ?? '—',
    companyName: (id?: string | null) => companies.find((c) => c.id === id)?.companyName ?? '—',
    siteName: (id?: string | null) => sites.find((s) => s.id === id)?.siteName ?? '—',
    userName: (id?: string | null) => users.find((u) => u.id === id)?.fullName ?? '—',
  }
}
