import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme, nextPreference } from '../lib/theme'
import type { ThemePreference } from '../lib/theme'

const ICON = { light: Sun, dark: Moon, system: Monitor }
const LABEL: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'Auto' }

export function ThemeToggle() {
  const { preference, cycle } = useTheme()
  const Icon = ICON[preference]
  const next = nextPreference(preference)
  return (
    <button
      onClick={cycle}
      className="btn-icon"
      aria-label={`Theme: ${LABEL[preference]}. Click to switch to ${LABEL[next]} mode`}
      title={`Theme: ${LABEL[preference]} (click for ${LABEL[next]})`}
    >
      <Icon size={14} aria-hidden />
      <span className="hidden sm:inline text-xs font-medium">{LABEL[preference]}</span>
    </button>
  )
}
