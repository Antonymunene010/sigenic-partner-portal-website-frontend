import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from './types'
import { loginWithApi, getMe, setToken, clearToken, getToken } from './api'

interface AuthCtx {
  user: User | null
  ready: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  setUser: (u: User | null) => void
}

const Ctx = createContext<AuthCtx | null>(null)
const SESSION_KEY = 'pp.session'

function loadSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => loadSession())
  const [ready, setReady] = useState(false)

  const setUser = (u: User | null) => {
    setUserState(u)
    try {
      if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore quota */
    }
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  // Validate a persisted session against the server on mount.
  useEffect(() => {
    if (getToken() && loadSession()) {
      getMe()
        .then((res) => setUser(res.user))
        .catch(() => logout())
        .finally(() => setReady(true))
    } else {
      setReady(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async (email: string, password: string) => {
    if (!password) return { ok: false, error: 'Please enter a password.' }
    try {
      const res = await loginWithApi(email, password)
      setToken(res.token)
      setUser(res.user)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Login failed.' }
    }
  }

  return <Ctx.Provider value={{ user, ready, login, logout, setUser }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
