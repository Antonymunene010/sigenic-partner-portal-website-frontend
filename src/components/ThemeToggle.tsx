import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark transition"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
