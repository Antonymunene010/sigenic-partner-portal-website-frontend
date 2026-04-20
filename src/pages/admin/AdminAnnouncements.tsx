import { useState } from 'react'
import { Megaphone, Pin, Send, Trash2 } from 'lucide-react'
import { load, save, uid } from '../../lib/storage'
import type { Announcement } from '../../lib/types'
import { seedAnnouncements } from '../../lib/seed'
import { fmtRelative } from '../../lib/format'
import { useNotifications } from '../../lib/notifications'
import { useAuth } from '../../lib/auth'
import clsx from 'clsx'

export default function AdminAnnouncements() {
  const { user } = useAuth()
  const { push } = useNotifications()
  const [items, setItems] = useState<Announcement[]>(() => load<Announcement[]>('announcements', seedAnnouncements))
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const persist = (next: Announcement[]) => { save('announcements', next); setItems(next) }

  const publish = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    const entry: Announcement = {
      id: uid('ann'),
      title: title.trim(),
      body: body.trim(),
      author: user?.name ?? 'Sigenic',
      createdAt: new Date().toISOString(),
      pinned,
    }
    persist([entry, ...items])
    push({ kind: 'announcement', title: entry.title, body: entry.body })
    setTitle(''); setBody(''); setPinned(false)
    setToast('Published. In production this would fan out to every partner — in this demo it appears in your own notifications.')
    setTimeout(() => setToast(null), 2600)
  }

  const togglePin = (id: string) => persist(items.map((a) => a.id === id ? { ...a, pinned: !a.pinned } : a))
  const del = (id: string) => persist(items.filter((a) => a.id !== id))

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight">Announcements</h2>
        <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">
          Publish product updates, maintenance notices, or training advisories. Each publish creates an in-app notification for every partner.
        </p>
      </div>

      <form onSubmit={publish} className="card p-5 mb-5 space-y-4">
        <div>
          <label className="label" htmlFor="ann-title">Title</label>
          <input id="ann-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short headline" required />
        </div>
        <div>
          <label className="label" htmlFor="ann-body">Body</label>
          <textarea id="ann-body" className="textarea min-h-[100px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed, why it matters, what partners should do." required />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to top
          </label>
          <button type="submit" className="btn-accent h-9 text-[12.5px]">
            <Send size={12} /> Publish
          </button>
        </div>
      </form>

      {toast && (
        <div className="mb-4 px-3 py-2 rounded-md text-[12.5px] bg-success/10 text-success border border-success/20 animate-fade-up">
          {toast}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
          <Megaphone size={14} className="text-muted dark:text-muted-dark" />
          <div className="text-[13px] font-medium">Published</div>
          <span className="ml-auto text-[11px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">{items.length} total</span>
        </div>
        <ul className="divide-hair">
          {items.map((a) => (
            <li key={a.id} className="px-4 py-3 flex items-start gap-3">
              <button
                onClick={() => togglePin(a.id)}
                className={clsx('mt-0.5 h-6 w-6 rounded-sm flex items-center justify-center transition',
                  a.pinned ? 'bg-accent text-accent-ink' : 'text-faint dark:text-faint-dark hover:text-ink dark:hover:text-ink-dark')}
                aria-label={a.pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={12} fill={a.pinned ? '#0A0A0A' : 'none'} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium">{a.title}</div>
                <div className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5 leading-relaxed">{a.body}</div>
                <div className="mt-1.5 text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">
                  {a.author} · {fmtRelative(a.createdAt)}
                </div>
              </div>
              <button onClick={() => del(a.id)} className="text-faint dark:text-faint-dark hover:text-danger" aria-label="Delete announcement">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="py-10 text-center text-[12.5px] text-muted dark:text-muted-dark">No announcements yet.</li>}
        </ul>
      </div>
    </div>
  )
}
