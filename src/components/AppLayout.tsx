import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'

export function AppLayout() {
  const { pathname } = useLocation()
  // The landing-style overview page manages its own full-bleed hero width.
  const isHub = pathname === '/app' || pathname === '/app/'

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-canvas-dark">
      <TopNav />
      <main className="flex-1">
        {isHub ? (
          <div className="animate-fade-up">
            <Outlet />
          </div>
        ) : (
          <div className="px-4 md:px-8 lg:px-10 py-6 md:py-8">
            <div className="max-w-[1240px] mx-auto animate-fade-up">
              <Outlet />
            </div>
          </div>
        )}
      </main>
      <footer className="px-4 md:px-8 py-5 border-t border-line dark:border-line-dark">
        <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark">
          <span>Sigenic · Partner Portal v0.2 · SG</span>
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" /> All systems operational
            </span>
            <span className="opacity-50">·</span>
            <span>© 2026 Sigenic</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
