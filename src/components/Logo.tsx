export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="32" height="32" rx="6" className="fill-ink dark:fill-ink-dark" />
      <path d="M8 22 L16 8 L24 22 L21 22 L16 14 L11 22 Z" fill="#C8A75B" />
      <rect x="14.5" y="18" width="3" height="1.5" className="fill-ink dark:fill-ink-dark" />
    </svg>
  )
}

export function WordMark() {
  return (
    <div className="flex items-center gap-2">
      <Logo size={22} />
      <div className="flex items-baseline gap-[6px] leading-none">
        <span className="font-semibold tracking-tightest text-[15px]">Sigenic</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted dark:text-muted-dark">
          Partner
        </span>
      </div>
    </div>
  )
}
