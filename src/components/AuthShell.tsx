import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { WordMark } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/** Full-screen chrome shared by the standalone auth pages (forgot/reset password):
 *  a back-to-sign-in link + theme toggle, then a centered, WordMark-topped column. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-canvas-dark">
      <div className="flex items-center justify-between p-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
        >
          <ArrowLeft size={16} /> Back to sign in
        </Link>
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <Link to="/" aria-label="Sigenic home" className="inline-block mb-8 transition-opacity hover:opacity-80">
            <WordMark className="h-10" />
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}
