import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { load, save, uid } from './storage'
import type { Notification } from './types'
import { seedNotifications } from './seed'

type PushInput = Omit<Notification, 'id' | 'createdAt' | 'read'>

interface NotificationsCtx {
  items: Notification[]
  unread: number
  push: (n: PushInput) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clear: () => void
}

const Ctx = createContext<NotificationsCtx | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>(() => load<Notification[]>('notifications', seedNotifications))
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    save('notifications', items)
  }, [items])

  const push = useCallback((n: PushInput) => {
    const entry: Notification = {
      id: uid('n'),
      createdAt: new Date().toISOString(),
      read: false,
      ...n,
    }
    setItems((xs) => [entry, ...xs].slice(0, 50))
  }, [])

  const markRead = useCallback((id: string) => {
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setItems((xs) => xs.map((n) => (n.read ? n : { ...n, read: true })))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const unread = items.filter((n) => !n.read).length

  return <Ctx.Provider value={{ items, unread, push, markRead, markAllRead, clear }}>{children}</Ctx.Provider>
}

export function useNotifications() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
