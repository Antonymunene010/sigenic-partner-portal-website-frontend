import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, Lightbulb, Send } from 'lucide-react'
import { load, nextTicketId, save } from '../lib/storage'
import type { CustomerImpact, Doc, ProductArea, Ticket, TicketCategory, TicketPriority } from '../lib/types'
import { seedDocs, seedTickets } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../lib/auth'
import { CUSTOMER_IMPACTS as IMPACTS, PRODUCT_AREAS as AREAS, TICKET_PRIORITIES as PRIORITIES } from '../lib/constants'
import { makeSystemMsg, makeUserMsg, systemRouted } from '../lib/tickets'

const CATS: { id: TicketCategory; label: string; desc: string }[] = [
  { id: 'bug', label: 'Bug / Issue', desc: 'Something is broken, unexpected, or regressed.' },
  { id: 'support', label: 'General support', desc: 'Questions, clarifications, how-to.' },
  { id: 'feature', label: 'Feature request', desc: 'Suggest an enhancement or new capability.' },
]

export default function NewTicket() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [category, setCategory] = useState<TicketCategory>('bug')
  const [priority, setPriority] = useState<TicketPriority>('normal')
  const [impact, setImpact] = useState<CustomerImpact>('medium')
  const [area, setArea] = useState<ProductArea>('Lithography')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [docs] = useState(() => load<Doc[]>('docs', seedDocs))

  const suggestions = useMemo(() => {
    const text = (subject + ' ' + body).toLowerCase().trim()
    if (text.length < 4) return []
    const terms = text.split(/\W+/).filter((t) => t.length >= 3)
    if (terms.length === 0) return []
    const scored = docs.map((d) => {
      const haystack = (d.title + ' ' + d.excerpt + ' ' + d.keywords.join(' ')).toLowerCase()
      let score = 0
      for (const t of terms) {
        if (d.keywords.includes(t)) score += 3
        else if (haystack.includes(t)) score += 1
      }
      if (d.category === 'Known Issues') score += 1
      return { d, score }
    })
    return scored
      .filter((x) => x.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.d)
  }, [subject, body, docs])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) return
    const tickets = load<Ticket[]>('tickets', seedTickets)
    const id = nextTicketId()
    const now = new Date().toISOString()
    const ticket: Ticket = {
      id,
      subject: subject.trim(),
      status: 'open',
      priority,
      category,
      productArea: area,
      customerImpact: impact,
      requester: user?.name ?? 'You',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
      source: 'portal',
      messages: [
        makeUserMsg(user?.name ?? 'You', body.trim(), now),
        makeSystemMsg(systemRouted(`${category} · ${area}`, 'SLA timer started.'), now),
      ],
    }
    save('tickets', [ticket, ...tickets])
    setCreated(id)
  }

  useEffect(() => {
    if (!created) return
    const t = setTimeout(() => nav(`/app/support/${created}`), 900)
    return () => clearTimeout(t)
  }, [created, nav])

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
        description="Your request mirrors into Zendesk and is triaged by the APAC partner team. Attach context — logs, SKUs, tool IDs, lot numbers."
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
              <label className="label">Type</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                    aria-pressed={category === c.id}
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
              <textarea
                id="body"
                className="textarea min-h-[160px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                placeholder="Describe what you're seeing, expected behavior, reproduction steps, affected SKUs, tool IDs, lot numbers…"
              />
              <div className="mt-1 text-[11px] text-faint dark:text-faint-dark flex justify-end font-mono">
                {body.length} chars
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="area">Product area</label>
                <select id="area" className="select" value={area} onChange={(e) => setArea(e.target.value as ProductArea)}>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="impact">Customer impact</label>
                <select id="impact" className="select" value={impact} onChange={(e) => setImpact(e.target.value as CustomerImpact)}>
                  {IMPACTS.map((i) => <option key={i} value={i} className="capitalize">{i}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="tags">Tags (comma-separated)</label>
              <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eg. EUV, firmware, lot-SPL-9A" />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-medium mb-2">
                <Lightbulb size={13} className="text-accent-dim" />
                Suggested articles
              </div>
              {suggestions.length === 0 ? (
                <div className="text-[11.5px] text-faint dark:text-faint-dark leading-snug">
                  Start typing — we’ll suggest relevant knowledge-base articles that might resolve your issue without a ticket.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {suggestions.map((d) => (
                    <li key={d.id}>
                      <Link
                        to={`/app/docs/${d.slug}`}
                        className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-raised dark:hover:bg-raised-dark"
                      >
                        <BookOpen size={12} className="mt-0.5 shrink-0 text-muted dark:text-muted-dark group-hover:text-accent transition" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium leading-snug">{d.title}</div>
                          <div className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark mt-0.5">
                            {d.category}
                          </div>
                        </div>
                        <ArrowUpRight size={11} className="text-faint dark:text-faint-dark opacity-0 group-hover:opacity-100 mt-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
                    aria-pressed={priority === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-faint dark:text-faint-dark leading-snug">
                Urgent and high priority page the APAC on-call team 24/7.
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
