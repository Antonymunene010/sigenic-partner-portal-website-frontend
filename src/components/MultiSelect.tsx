import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useOutsideClick } from '../lib/useOutsideClick'

/**
 * Multi-checkbox filter dropdown used in oversight tables.
 * Empty selection means "no filter" — surface that as the placeholder label.
 */
export function MultiSelect<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${selected.length} selected`

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx('select sm:w-56 text-left truncate', selected.length === 0 && 'text-faint dark:text-faint-dark')}
        aria-label={label}
        aria-expanded={open}
      >
        {summary}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[12rem] card shadow-lift p-1 animate-fade-up z-20">
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-2 py-1.5 rounded text-[13px] text-muted dark:text-muted-dark hover:bg-raised dark:hover:bg-raised-dark transition"
          >
            {label}
          </button>
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] hover:bg-raised dark:hover:bg-raised-dark cursor-pointer transition"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-accent"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
