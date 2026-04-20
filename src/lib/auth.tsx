import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save, remove } from './storage'
import type { User } from './types'
import { seedUsers } from './seed'

interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  impersonate: (role: 'partner' | 'admin') => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => load<User | null>('session', null))

  useEffect(() => {
    if (user) save('session', user)
    else remove('session')
  }, [user])

  const login = (email: string, password: string) => {
    const users = load<User[]>('users', seedUsers)
    const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!found) return { ok: false, error: 'No account found for that email.' }
    if (!found.active) return { ok: false, error: 'This account is deactivated.' }
    // Demo: accept any non-empty password. Show hint on login page.
    if (!password) return { ok: false, error: 'Please enter a password.' }
    setUser(found)
    return { ok: true }
  }

  const logout = () => setUser(null)

  const impersonate = (role: 'partner' | 'admin') => {
    const users = load<User[]>('users', seedUsers)
    const found = users.find((u) => u.role === role && u.active)
    if (found) setUser(found)
  }

  return <Ctx.Provider value={{ user, login, logout, impersonate }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
