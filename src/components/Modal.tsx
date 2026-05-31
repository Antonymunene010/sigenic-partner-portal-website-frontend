import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  // Keep the latest onClose in a ref so the effect depends only on `open`. Callers pass a fresh
  // onClose closure each render, so depending on it would re-run this on every keystroke in a modal
  // form — churning the keydown listener and scroll-lock for no reason.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    // Lock background scroll so the modal never depends on the page scrollbar.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null
  // Portal to <body> so the fixed overlay is relative to the viewport, not trapped by an ancestor
  // with a transform (e.g. the page's `animate-fade-up` wrapper), which would clip the backdrop.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`relative card-raised w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-full flex flex-col animate-fade-up`}
      >
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-line dark:border-line-dark shrink-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-faint hover:text-ink dark:hover:text-ink-dark" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line dark:border-line-dark shrink-0">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
