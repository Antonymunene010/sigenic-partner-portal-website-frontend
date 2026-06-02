import logoUrl from '../assets/Logo.avif'

/**
 * Sigenic brand logo — the official white wordmark lock-up (transparent bg).
 * The artwork is pure white, so we invert it to near-black in light mode and
 * leave it as-is in dark mode; every surface it sits on follows the theme.
 * Pass `className` to size it (a height utility); width stays auto.
 */
export function Logo({ className = 'h-9' }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Sigenic"
      draggable={false}
      className={`w-auto select-none invert dark:invert-0 ${className}`}
    />
  )
}

// Existing call sites import WordMark; keep it as a thin alias over Logo.
export function WordMark({ className }: { className?: string }) {
  return <Logo className={className} />
}
