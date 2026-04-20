import { LogOut, Search, UserCog } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { ThemeToggle } from './ThemeToggle'
import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { NotificationsMenu } from './NotificationsMenu'

export function Topbar() {
  const { user, logout, impersonate } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!user) return null

  return (
    <header className="h-14 border-b border-line dark:border-line-dark flex items-center px-4 md:px-6 gap-3 bg-canvas/80 dark:bg-canvas-dark/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint dark:text-faint-dark" aria-hidden />
        <input
          aria-label="Search portal"
          placeholder="Search tickets, docs, stories…"
          className="input pl-9 pr-16 h-9"
          onFocus={(e) => e.target.select()}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1" aria-hidden>
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsMenu />
        <ThemeToggle />
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md border border-line dark:border-line-dark bg-surface dark:bg-surface-dark hover:bg-raised dark:hover:bg-raised-dark transition"
            aria-label="User menu"
            aria-expanded={open}
          >
            <Avatar name={user.name} size="sm" />
            <div className="text-left hidden sm:block leading-tight">
              <div className="text-[12px] font-medium">{user.name}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted dark:text-muted-dark">
                {user.role}
              </div>
            </div>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-64 card shadow-lift p-1 animate-fade-up">
              <div className="px-3 py-2.5 border-b border-line dark:border-line-dark">
                <div className="text-[13px] font-medium">{user.name}</div>
                <div className="text-[11px] text-muted dark:text-muted-dark">{user.email}</div>
                <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark mt-1">
                  {user.company}
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    impersonate(user.role === 'admin' ? 'partner' : 'admin')
                    setOpen(false)
                    nav('/app')
                  }}
                  className="w-full text-left text-[13px] px-2 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark flex items-center gap-2"
                >
                  <UserCog size={14} />
                  Switch to {user.role === 'admin' ? 'Partner' : 'Admin'} view
                </button>
                <button
                  onClick={() => {
                    logout()
                    nav('/login')
                  }}
                  className="w-full text-left text-[13px] px-2 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark flex items-center gap-2 text-danger"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
