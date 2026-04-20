import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  LifeBuoy,
  Sparkles,
  BookOpen,
  CalendarClock,
  CreditCard,
  Calculator,
  Shield,
} from 'lucide-react'
import clsx from 'clsx'
import { WordMark } from './Logo'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/support', label: 'Support', icon: LifeBuoy },
  { to: '/app/stories', label: 'Success stories', icon: Sparkles },
  { to: '/app/docs', label: 'Knowledge base', icon: BookOpen },
  { to: '/app/services', label: 'Request a service', icon: CalendarClock },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/calculator', label: 'Score calculator', icon: Calculator, highlight: true },
]

export function Sidebar() {
  const { user } = useAuth()
  return (
    <aside className="h-full w-60 shrink-0 border-r border-line dark:border-line-dark flex flex-col bg-surface/60 dark:bg-surface-dark/60 backdrop-blur-sm">
      <div className="h-14 flex items-center px-4 border-b border-line dark:border-line-dark">
        <WordMark />
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="px-2 mb-2 text-2xs uppercase tracking-[0.14em] text-faint dark:text-faint-dark font-medium">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center gap-2.5 px-2.5 h-8 text-[13px] rounded-md transition',
                    isActive
                      ? 'bg-raised dark:bg-raised-dark text-ink dark:text-ink-dark font-medium'
                      : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised/60 dark:hover:bg-raised-dark/60',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition',
                        isActive ? 'bg-accent' : 'bg-transparent',
                      )}
                    />
                    <item.icon size={14} strokeWidth={1.75} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.highlight && !isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {user?.role === 'admin' && (
          <>
            <div className="mt-6 px-2 mb-2 text-2xs uppercase tracking-[0.14em] text-faint dark:text-faint-dark font-medium">
              Admin
            </div>
            <ul className="space-y-0.5">
              <li>
                <NavLink
                  to="/app/admin"
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex items-center gap-2.5 px-2.5 h-8 text-[13px] rounded-md transition',
                      isActive
                        ? 'bg-raised dark:bg-raised-dark text-ink dark:text-ink-dark font-medium'
                        : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised/60 dark:hover:bg-raised-dark/60',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={clsx(
                          'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full transition',
                          isActive ? 'bg-accent' : 'bg-transparent',
                        )}
                      />
                      <Shield size={14} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">Admin panel</span>
                    </>
                  )}
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-line dark:border-line-dark">
        <div className="rounded-md border border-line dark:border-line-dark p-3 bg-raised/40 dark:bg-raised-dark/40">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-dot" />
            <span className="text-2xs font-mono uppercase tracking-[0.12em] text-muted dark:text-muted-dark">
              APAC · SG-1 online
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-faint dark:text-faint-dark">
            All systems nominal. Incident-free 42d.
          </p>
        </div>
      </div>
    </aside>
  )
}
