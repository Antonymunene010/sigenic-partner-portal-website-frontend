import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme, nextPreference } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'

const ICON = { light: Sun, dark: Moon, system: SunMoon }
const LABEL: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'Auto' }

export function ThemeToggle() {
  const { preference, cycle } = useTheme()
  const Icon = ICON[preference]
  const next = nextPreference(preference)
  return (
    <button
      onClick={cycle}
      className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark transition"
      aria-label={`Theme: ${LABEL[preference]}. Switch to ${LABEL[next]} mode`}
      title={`Theme: ${LABEL[preference]} (click for ${LABEL[next]})`}
    >
      <Icon size={14} />
    </button>
  )
}
