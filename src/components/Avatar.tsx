import clsx from 'clsx'
import { initials } from '../lib/format'

type Variant = 'ink' | 'accent' | 'faint'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  ink: 'bg-ink text-canvas dark:bg-ink-dark dark:text-canvas-dark',
  accent: 'bg-accent text-accent-ink',
  faint: 'bg-faint/30 text-muted dark:text-faint-dark',
}

const SIZES: Record<Size, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-7 h-7 text-[11px]',
}

export function Avatar({
  name,
  variant = 'ink',
  size = 'sm',
  className,
}: {
  name: string
  variant?: Variant
  size?: Size
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={clsx(
        'rounded-sm flex items-center justify-center font-medium shrink-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}
