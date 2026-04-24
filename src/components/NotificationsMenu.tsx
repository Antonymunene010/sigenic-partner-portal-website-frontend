import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, CheckCheck, Megaphone, LifeBuoy, BookOpen } from 'lucide-react'
import clsx from 'clsx'
import { useNotifications } from '../lib/notifications'
import { useOutsideClick } from '../lib/useOutsideClick'
import type { NotificationKind } from '../lib/types'
import { fmtRelative } from '../lib/format'

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  ticket: LifeBuoy,
  knowledge: BookOpen,
  announcement: Megaphone,
}

export function NotificationsMenu() {
  const { items, unread, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-8 w-8 inline-flex items-center justify-center rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark hover:bg-raised dark:hover:bg-raised-dark transition"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full bg-accent text-accent-ink text-[9px] font-mono font-semibold flex items-center justify-center"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[340px] card shadow-lift p-0 animate-fade-up overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-line dark:border-line-dark">
            <div className="text-[13px] font-medium">Notifications</div>
            {unread > 0 ? (
              <button
                onClick={markAllRead}
                className="text-[11px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark inline-flex items-center gap-1"
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            ) : (
              <span className="text-[10.5px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">all caught up</span>
            )}
          </div>
          <ul className="max-h-[360px] overflow-y-auto divide-hair">
            {items.length === 0 && (
              <li className="py-10 text-center text-[12.5px] text-faint dark:text-faint-dark">No notifications yet.</li>
            )}
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind]
              const rowClass = clsx(
                'flex items-start gap-2.5 px-3 py-2.5 transition w-full text-left',
                !n.read && 'bg-accent/5',
                'hover:bg-raised/60 dark:hover:bg-raised-dark/60',
              )
              const inner = (
                <>
                  <div className="relative mt-0.5">
                    <div className={clsx(
                      'w-6 h-6 rounded-sm flex items-center justify-center',
                      n.kind === 'announcement' && 'bg-accent/15 text-accent-ink',
                      n.kind === 'ticket' && 'bg-info/10 text-info',
                      n.kind === 'knowledge' && 'bg-raised dark:bg-raised-dark text-muted dark:text-muted-dark',
                    )}>
                      <Icon size={12} />
                    </div>
                    {!n.read && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium leading-snug">{n.title}</div>
                    <div className="text-[11.5px] text-muted dark:text-muted-dark leading-snug mt-0.5 line-clamp-2">
                      {n.body}
                    </div>
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">
                      {n.kind} · {fmtRelative(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && <Check size={12} className="mt-1 text-faint dark:text-faint-dark" aria-hidden />}
                </>
              )
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      to={n.link}
                      onClick={() => { markRead(n.id); setOpen(false) }}
                      className={rowClass}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => markRead(n.id)} className={rowClass}>
                      {inner}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="px-3 py-2 border-t border-line dark:border-line-dark text-[11px] text-faint dark:text-faint-dark">
            Email notifications also enabled. Manage in Settings (coming soon).
          </div>
        </div>
      )}
    </div>
  )
}
