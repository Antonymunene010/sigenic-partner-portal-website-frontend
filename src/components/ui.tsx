import clsx from 'clsx'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

/* ---------- Card ---------- */
export function Card({
  children,
  className,
  title,
  eyebrow,
  actions,
  padded = true,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  padded?: boolean
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions || eyebrow) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line dark:border-line-dark">
          <div>
            {eyebrow && <div className="stat-label mb-1">{eyebrow}</div>}
            {title && <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5')}>{children}</div>
    </section>
  )
}

/* ---------- StatCard ---------- */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
  icon,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  accent?: boolean
  icon?: ReactNode
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && <span className="text-faint dark:text-faint-dark">{icon}</span>}
      </div>
      <div className={clsx('text-2xl font-semibold tracking-tight num', accent && 'text-emphasis')}>{value}</div>
      {sub && <div className="text-xs text-muted dark:text-muted-dark">{sub}</div>}
    </div>
  )
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="mb-3 text-faint dark:text-faint-dark">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted dark:text-muted-dark max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------- Field ---------- */
export function Field({ label, hint, error, children, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-faint dark:text-faint-dark">{hint}</p>
      ) : null}
    </div>
  )
}

/* ---------- NumberField (calculator inputs) ---------- */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step,
}: {
  label: string
  value: number | undefined
  onChange: (n: number) => void
  unit?: string
  step?: number
}) {
  return (
    <Field label={unit ? `${label} (${unit})` : label}>
      <input
        className="input num"
        type="number"
        step={step ?? 'any'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </Field>
  )
}

/* ---------- chipClass — shared active/inactive tab+filter pill ---------- */
export function chipClass(active: boolean): string {
  return clsx(
    'px-3 h-8 rounded-md text-sm font-medium transition',
    active ? 'bg-accent/15 text-emphasis' : 'text-muted dark:text-muted-dark hover:bg-raised dark:hover:bg-raised-dark',
  )
}

/* ---------- Spinner ---------- */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted dark:text-muted-dark">
      <span className="inline-block w-4 h-4 rounded-full border-2 border-line dark:border-line-dark border-t-accent animate-spin" />
      {label ?? 'Loading…'}
    </div>
  )
}

/* ---------- Toast ---------- */
type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}
interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void
}
const Ctx = createContext<ToastCtx | null>(null)
let toastSeq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++toastSeq
    setItems((cur) => [...cur, { id, kind, message }])
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000)
  }, [])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]">
        {items.map((t) => (
          <div
            key={t.id}
            className="card-raised flex items-start gap-2.5 p-3 text-sm animate-fade-up shadow-lift"
            role="status"
          >
            <span className={clsx('mt-0.5', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-info')}>
              {t.kind === 'success' ? <CheckCircle2 size={16} /> : t.kind === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            </span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} className="text-faint hover:text-ink dark:hover:text-ink-dark">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
