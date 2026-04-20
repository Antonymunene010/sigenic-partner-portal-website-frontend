import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  return (
    <div className="min-h-screen flex bg-canvas dark:bg-canvas-dark">
      <div className="hidden md:block sticky top-0 h-screen">
        <Sidebar />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 px-4 md:px-8 lg:px-10 py-6 md:py-8">
          <div className="max-w-[1240px] mx-auto animate-fade-up">
            <Outlet />
          </div>
        </main>
        <footer className="px-4 md:px-8 py-4 border-t border-line dark:border-line-dark text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark flex items-center justify-between">
          <span>Axiom Foundry · Partner Portal v0.1 · SG</span>
          <span>© 2026 · Demo build</span>
        </footer>
      </div>
    </div>
  )
}
