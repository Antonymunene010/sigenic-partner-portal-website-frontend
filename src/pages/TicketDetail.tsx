import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, MessageCircle, XCircle } from 'lucide-react'
import { load, save, uid } from '../lib/storage'
import type { Ticket, TicketStatus } from '../lib/types'
import { seedTickets } from '../lib/seed'
import { Badge } from '../components/Badge'
import { fmtDateTime, fmtRelative } from '../lib/format'
import { useAuth } from '../lib/auth'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [tick, setTick] = useState<number>(0)
  const tickets = useMemo(() => load<Ticket[]>('tickets', seedTickets), [tick])
  const ticket = tickets.find((t) => t.id === id)
  const [reply, setReply] = useState('')

  if (!ticket) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <div className="text-[13px] font-mono text-muted dark:text-muted-dark">Ticket not found</div>
        <Link to="/app/support" className="btn-outline mt-4 inline-flex">
          <ArrowLeft size={12} /> Back to tickets
        </Link>
      </div>
    )
  }

  const updateTicket = (fn: (t: Ticket) => Ticket) => {
    const next = tickets.map((t) => (t.id === ticket.id ? fn(t) : t))
    save('tickets', next)
    setTick((x) => x + 1)
  }

  const send = () => {
    if (!reply.trim()) return
    const now = new Date().toISOString()
    updateTicket((t) => ({
      ...t,
      updatedAt: now,
      status: t.status === 'solved' || t.status === 'closed' ? 'open' : t.status,
      messages: [
        ...t.messages,
        { id: uid('m'), author: user?.name ?? 'You', authorRole: 'you', body: reply.trim(), createdAt: now },
      ],
    }))
    setReply('')
    // simulated agent response after 1.2s
    setTimeout(() => {
      updateTicket((t) => ({
        ...t,
        updatedAt: new Date().toISOString(),
        status: 'pending',
        messages: [
          ...t.messages,
          {
            id: uid('m'),
            author: 'Axiom Support',
            authorRole: 'agent',
            body: 'Thanks — looking at this now, we will follow up shortly with more details.',
            createdAt: new Date().toISOString(),
          },
        ],
      }))
    }, 1200)
  }

  const setStatus = (s: TicketStatus) => updateTicket((t) => ({ ...t, status: s, updatedAt: new Date().toISOString() }))

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <Link to="/app/support" className="inline-flex items-center gap-1 text-[12px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark">
          <ArrowLeft size={12} /> Back to tickets
        </Link>
        <div className="flex items-center gap-1.5">
          {ticket.status !== 'solved' && (
            <button onClick={() => setStatus('solved')} className="btn-outline h-8 text-[12px]">
              <CheckCircle2 size={12} /> Mark solved
            </button>
          )}
          {ticket.status !== 'closed' && (
            <button onClick={() => { setStatus('closed'); setTimeout(() => nav('/app/support'), 600) }} className="btn-outline h-8 text-[12px] text-danger border-danger/20 hover:bg-danger/5">
              <XCircle size={12} /> Close
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="mb-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted dark:text-muted-dark">
              {ticket.id} · opened {fmtDateTime(ticket.createdAt)}
            </div>
            <h1 className="mt-2 text-[26px] font-semibold tracking-tightest leading-tight">
              {ticket.subject}
            </h1>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge tone={ticket.status} dot>{ticket.status}</Badge>
              <Badge tone={ticket.priority}>{ticket.priority}</Badge>
              <span className="text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.12em]">
                {ticket.category}
              </span>
              {ticket.tags.map((t) => (
                <span key={t} className="text-[10.5px] font-mono text-muted dark:text-muted-dark px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <ol className="space-y-4">
            {ticket.messages.map((m) => (
              <li key={m.id} className={`card p-4 ${m.authorRole === 'system' ? 'bg-raised/50 dark:bg-raised-dark/50 border-dashed' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-medium ${
                      m.authorRole === 'you' ? 'bg-ink text-canvas dark:bg-ink-dark dark:text-canvas-dark'
                      : m.authorRole === 'agent' ? 'bg-accent text-accent-ink'
                      : 'bg-faint/30 text-muted dark:text-faint-dark'
                    }`}>
                      {m.author.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-[12.5px] font-medium leading-tight">{m.author}</div>
                      <div className="text-[10.5px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                        {m.authorRole === 'you' ? 'You' : m.authorRole}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-faint dark:text-faint-dark">
                    {fmtRelative(m.createdAt)}
                  </div>
                </div>
                <div className="text-[13.5px] leading-relaxed text-ink dark:text-ink-dark whitespace-pre-wrap">
                  {m.body}
                </div>
              </li>
            ))}
          </ol>

          {ticket.status !== 'closed' && (
            <div className="mt-4 card p-4">
              <label className="label flex items-center gap-1.5"><MessageCircle size={12} /> Add a reply</label>
              <textarea
                className="textarea min-h-[100px]"
                placeholder="Write a message…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="text-[11px] text-faint dark:text-faint-dark">
                  Tip: include tool IDs, timestamps, and lot numbers for faster triage.
                </div>
                <button onClick={send} disabled={!reply.trim()} className="btn-accent h-9 disabled:opacity-50">
                  Send reply
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="text-[12px] font-medium mb-3">Details</div>
            <dl className="text-[12.5px] space-y-2.5">
              <Row k="Requester" v={ticket.requester} />
              <Row k="Assignee" v={ticket.assignee ?? '—'} />
              <Row k="Category" v={<span className="capitalize">{ticket.category}</span>} />
              <Row k="Created" v={<span className="font-mono text-[11.5px]">{fmtDateTime(ticket.createdAt)}</span>} />
              <Row k="Updated" v={<span className="font-mono text-[11.5px]">{fmtRelative(ticket.updatedAt)}</span>} />
            </dl>
          </div>
          <div className="card p-4">
            <div className="text-[12px] font-medium mb-2">Zendesk</div>
            <div className="text-[12px] text-muted dark:text-muted-dark leading-relaxed">
              Mirrored as ticket <span className="font-mono text-ink dark:text-ink-dark">{ticket.id.replace('TKT-', 'ZEN-')}</span> in queue <span className="font-mono">axiom/{ticket.category}</span>.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted dark:text-muted-dark">{k}</dt>
      <dd className="text-ink dark:text-ink-dark text-right">{v}</dd>
    </div>
  )
}
