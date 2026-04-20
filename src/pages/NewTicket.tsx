import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Send } from 'lucide-react'
import { load, save, uid } from '../lib/storage'
import type { Ticket, TicketCategory, TicketPriority } from '../lib/types'
import { seedTickets } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../lib/auth'

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent']
const CATS: { id: TicketCategory; label: string; desc: string }[] = [
  { id: 'technical', label: 'Technical', desc: 'Tool, firmware, calibration, API.' },
  { id: 'billing', label: 'Billing', desc: 'Invoices, credits, contracts.' },
  { id: 'demo', label: 'Demo request', desc: 'Evaluate a new tool or capability.' },
  { id: 'feature', label: 'Feature', desc: 'Request enhancements to the portal.' },
  { id: 'general', label: 'General', desc: 'Anything else.' },
]

export default function NewTicket() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [category, setCategory] = useState<TicketCategory>('technical')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [created, setCreated] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    const tickets = load<Ticket[]>('tickets', seedTickets)
    const id = 'TKT-' + String(Math.floor(242 + Math.random() * 700)).padStart(5, '0')
    const now = new Date().toISOString()
    const ticket: Ticket = {
      id,
      subject: subject.trim(),
      status: 'open',
      priority,
      category,
      requester: user?.name ?? 'You',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: uid('m'), author: user?.name ?? 'You', authorRole: 'you', body: body.trim(), createdAt: now },
        {
          id: uid('m'),
          author: 'System',
          authorRole: 'system',
          body: `Ticket routed to Axiom · ${category} queue. SLA timer started.`,
          createdAt: now,
        },
      ],
    }
    save('tickets', [ticket, ...tickets])
    setCreated(id)
    setTimeout(() => nav(`/app/support/${id}`), 900)
  }

  return (
    <div>
      <div className="mb-5">
        <Link to="/app/support" className="inline-flex items-center gap-1 text-[12px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark">
          <ArrowLeft size={12} /> Back to tickets
        </Link>
      </div>
      <PageHeader
        eyebrow="Support · New request"
        title="Submit a support request"
        description="Your request is routed to Zendesk and triaged by the APAC partner team. Attach context — logs, SKUs, tool IDs."
      />

      {created ? (
        <div className="card p-10 text-center max-w-md mx-auto animate-fade-up">
          <div className="w-10 h-10 mx-auto rounded-full bg-success/10 text-success flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div className="mt-3 text-[17px] font-semibold tracking-tight">Ticket {created} submitted</div>
          <div className="mt-1 text-[13px] text-muted dark:text-muted-dark">Routing to {category} queue…</div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card p-5 space-y-5">
            <div>
              <label className="label">Category</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CATS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`text-left rounded-md border px-3 py-2.5 transition ${
                      category === c.id
                        ? 'border-ink dark:border-ink-dark bg-raised/70 dark:bg-raised-dark/70'
                        : 'border-line dark:border-line-dark hover:border-line-strong dark:hover:border-line-strong-dark'
                    }`}
                  >
                    <div className="text-[13px] font-medium">{c.label}</div>
                    <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5 leading-snug">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="subject">Subject</label>
              <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Short, specific summary" />
            </div>

            <div>
              <label className="label" htmlFor="body">Description</label>
              <textarea id="body" className="textarea min-h-[160px]" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Describe what you're seeing, expected behavior, reproduction steps, affected SKUs or tool IDs…" />
              <div className="mt-1 text-[11px] text-faint dark:text-faint-dark flex justify-end font-mono">
                {body.length} chars
              </div>
            </div>

            <div>
              <label className="label" htmlFor="tags">Tags (comma-separated)</label>
              <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eg. EUV, firmware, lot-SPL-9A" />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="text-[12px] font-medium mb-2">Priority</div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`capitalize text-[12px] h-8 rounded-md border transition ${
                      priority === p
                        ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark font-medium'
                        : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-faint dark:text-faint-dark leading-snug">
                Urgent and high-priority tickets page the APAC on-call team 24/7.
              </p>
            </div>

            <div className="card p-4 text-[12px] space-y-2">
              <div className="font-medium">Response targets</div>
              <ul className="text-muted dark:text-muted-dark space-y-1">
                <li className="flex justify-between"><span>Urgent</span><span className="font-mono">1h / 8h</span></li>
                <li className="flex justify-between"><span>High</span><span className="font-mono">4h / 1d</span></li>
                <li className="flex justify-between"><span>Normal</span><span className="font-mono">1d</span></li>
                <li className="flex justify-between"><span>Low</span><span className="font-mono">2d</span></li>
              </ul>
            </div>

            <button type="submit" className="btn-accent w-full h-10">
              <Send size={14} /> Submit ticket
            </button>
          </aside>
        </form>
      )}
    </div>
  )
}
