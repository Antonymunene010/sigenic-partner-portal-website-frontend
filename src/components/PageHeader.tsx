import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="text-3xl md:text-[34px] font-semibold tracking-tightest text-balance leading-[1.1]">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-muted dark:text-muted-dark text-[15px] text-pretty leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
