import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'

// What the user picked. 'system' follows the OS color-scheme and is the default.
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

const MEDIA = '(prefers-color-scheme: dark)'

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia(MEDIA).matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    load<ThemePreference>('theme', 'system'),
  )
  const [systemPref, setSystemPref] = useState<ResolvedTheme>(systemTheme)

  // Keep up with the OS preference; only matters while preference === 'system'.
  useEffect(() => {
    const mq = window.matchMedia(MEDIA)
    const onChange = () => setSystemPref(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: ResolvedTheme = preference === 'system' ? systemPref : preference

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
