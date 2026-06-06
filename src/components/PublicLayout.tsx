import { Link, NavLink, Outlet } from 'react-router-dom'
import { WordMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/stories', label: 'Success stories' },
  { to: '/calculator', label: 'Risk calculator' },
  { to: '/contact', label: 'Contact' },
]

export function PublicLayout() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-canvas-dark">
      <header className="sticky top-0 z-30 h-16 flex items-center gap-6 px-4 md:px-8 border-b border-line dark:border-line-dark bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur">
        <Link to="/app">
          <WordMark />
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `px-3 h-9 inline-flex items-center rounded-md text-sm transition ${
                  isActive ? 'text-emphasis font-medium' : 'text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link to="/app" className="btn-outline">
              Open portal
            </Link>
          ) : (
            <Link to="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
          <Link to="/contact" className="btn-accent">
            Request a demo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="px-4 md:px-8 py-8 border-t border-line dark:border-line-dark">
        <div className="max-w-[1180px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <WordMark />
          <p className="text-sm text-muted dark:text-muted-dark max-w-md">
            The operating system for partner interactions with Sigenic — support, ROI self-service and case studies under the Sigenic Care program.
          </p>
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark">© 2026 Sigenic · Singapore</span>
        </div>
      </footer>
    </div>
  )
}
