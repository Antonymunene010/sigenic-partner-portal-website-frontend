import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={ref}
        className={`relative card-raised w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto animate-fade-up`}
      >
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-line dark:border-line-dark">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink dark:hover:text-ink-dark" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line dark:border-line-dark">{footer}</footer>}
      </div>
    </div>
  )
}
