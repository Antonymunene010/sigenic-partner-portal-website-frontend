import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'

// What the user picked. 'system' switches by local time of day and is the default.
export type ThemePreference = 'light' | 'dark' | 'system'
// What is actually applied to the document (system is resolved against the OS).
type ResolvedTheme = 'light' | 'dark'

// Single source of truth for the toggle click order: light → dark → system → light.
const CYCLE: ThemePreference[] = ['light', 'dark', 'system']
export function nextPreference(p: ThemePreference): ThemePreference {
  return CYCLE[(CYCLE.indexOf(p) + 1) % CYCLE.length]
}

interface ThemeCtx {
  preference: ThemePreference
  theme: ResolvedTheme
  cycle: () => void
  set: (p: ThemePreference) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

// Daytime window for the 'system' preference: light within [start, end), dark outside.
const DAY_START_HOUR = 7
const DAY_END_HOUR = 19

function timeTheme(now = new Date()): ResolvedTheme {
  const h = now.getHours()
  return h >= DAY_START_HOUR && h < DAY_END_HOUR ? 'light' : 'dark'
}

function msUntilNextBoundary(now = new Date()): number {
  const next = new Date(now)
  const h = now.getHours()
  if (h >= DAY_END_HOUR) next.setDate(next.getDate() + 1)
  next.setHours(h >= DAY_START_HOUR && h < DAY_END_HOUR ? DAY_END_HOUR : DAY_START_HOUR, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    load<ThemePreference>('theme', 'system'),
  )
  const [autoTheme, setAutoTheme] = useState<ResolvedTheme>(() => timeTheme())

  // Flip at the next day/night boundary; only matters while preference === 'system'.
  // Timers are unreliable in backgrounded tabs, so also re-check on visibility.
  useEffect(() => {
    let timer: number
    const arm = () => {
      timer = window.setTimeout(() => {
        setAutoTheme(timeTheme())
        arm()
      }, msUntilNextBoundary())
    }
    arm()
    const onVisible = () => {
      if (!document.hidden) setAutoTheme(timeTheme())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const theme: ResolvedTheme = preference === 'system' ? autoTheme : preference

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    save('theme', preference)
  }, [preference])

  return (
    <Ctx.Provider
      value={{
        preference,
        theme,
        cycle: () => setPreference(nextPreference),
        set: setPreference,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
