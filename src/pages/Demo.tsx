import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Send } from 'lucide-react'
import { load, save, uid } from '../lib/storage'
import type { Ticket } from '../lib/types'
import { seedTickets } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../lib/auth'

const INTERESTS = [
  { id: 'ax-etch-600', label: 'AX-Etch 600', family: 'Etch' },
  { id: 'ax-litho-900', label: 'AX-Litho 900', family: 'Lithography' },
  { id: 'ax-depose-300', label: 'AX-Depose 300', family: 'Deposition' },
  { id: 'ax-inspect-v5', label: 'AX-Inspect V5', family: 'Inspection' },
  { id: 'ax-metro-pro', label: 'AX-Metro Pro', family: 'Metrology' },
]

export default function Demo() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [interest, setInterest] = useState<string[]>([])
  const [format, setFormat] = useState<'on-site' | 'remote' | 'either'>('on-site')
  const [timeframe, setTimeframe] = useState<'2w' | '1m' | 'q'>('2w')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const toggle = (id: string) =>
    setInterest((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (interest.length === 0) return
    const tickets = load<Ticket[]>('tickets', seedTickets)
    const id = 'TKT-' + String(Math.floor(242 + Math.random() * 700)).padStart(5, '0')
    const now = new Date().toISOString()
    const labels = INTERESTS.filter((i) => interest.includes(i.id)).map((i) => i.label)
    const body = `We'd like to evaluate: ${labels.join(', ')}.\nPreferred format: ${format}.\nTimeframe: ${timeframe === '2w' ? 'within 2 weeks' : timeframe === '1m' ? 'within 1 month' : 'this quarter'}.\n${notes ? '\nNotes: ' + notes : ''}`
    const ticket: Ticket = {
      id,
      subject: `Demo request · ${labels.join(' + ')}`,
      status: 'open',
      priority: 'normal',
      category: 'demo',
      requester: user?.name ?? 'You',
      tags: ['demo', ...labels.map((l) => l.toLowerCase().replace(/\s+/g, '-'))],
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: uid('m'), author: user?.name ?? 'You', authorRole: 'you', body, createdAt: now },
        { id: uid('m'), author: 'System', authorRole: 'system', body: 'Demo request routed to Axiom APAC sales. A rep will reach out within 1 business day.', createdAt: now },
      ],
    }
    save('tickets', [ticket, ...tickets])
    setDone(id)
    setTimeout(() => nav(`/app/support/${id}`), 1000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Demos & services"
        title="Request a demo"
        description="Evaluate a tool or capability in your facility — or remotely. Requests route to APAC sales and become a ticket you can track."
      />

      {done ? (
        <div className="card p-10 text-center max-w-md mx-auto animate-fade-up">
          <div className="w-10 h-10 mx-auto rounded-full bg-success/10 text-success flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div className="mt-3 text-[17px] font-semibold tracking-tight">Demo request {done} sent</div>
          <div className="mt-1 text-[13px] text-muted dark:text-muted-dark">Opening ticket…</div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5">
              <label className="label">What would you like to evaluate? <span className="text-faint dark:text-faint-dark">· pick one or more</span></label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {INTERESTS.map((i) => {
                  const on = interest.includes(i.id)
                  return (
                    <button
                      type="button"
                      key={i.id}
                      onClick={() => toggle(i.id)}
                      className={`text-left rounded-md border px-3 py-3 transition flex items-start gap-3 ${
                        on ? 'border-ink dark:border-ink-dark bg-raised/70 dark:bg-raised-dark/70' : 'border-line dark:border-line-dark hover:border-line-strong dark:hover:border-line-strong-dark'
                      }`}
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-accent border-accent' : 'border-line-strong dark:border-line-strong-dark'}`}>
                        {on && <CheckCircle2 size={12} className="text-accent-ink" />}
                      </span>
                      <span>
                        <span className="text-[13px] font-medium block">{i.label}</span>
                        <span className="text-[11px] text-muted dark:text-muted-dark font-mono uppercase tracking-[0.08em]">{i.family}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="card p-5">
              <label className="label">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(['on-site', 'remote', 'either'] as const).map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`h-10 rounded-md text-[13px] capitalize border transition ${
                      format === f ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark font-medium' : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <label className="label">Timeframe</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: '2w', label: 'Within 2 weeks' },
                  { id: '1m', label: 'Within 1 month' },
                  { id: 'q', label: 'This quarter' },
                ] as const).map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTimeframe(t.id)}
                    className={`h-10 rounded-md text-[13px] border transition ${
                      timeframe === t.id ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark font-medium' : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <label className="label" htmlFor="notes">Context</label>
              <textarea id="notes" className="textarea min-h-[100px]" placeholder="Pilot constraints, target process steps, security requirements, facility access…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-accent" />
                <div className="text-[13px] font-medium">What to expect</div>
              </div>
              <ol className="mt-3 space-y-2.5 text-[12.5px] text-muted dark:text-muted-dark leading-relaxed">
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">01</span> <span>APAC sales rep confirms within 1 business day.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">02</span> <span>Logistics checklist: facility access, network, target lots.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">03</span> <span>Demo run · typically half a day on-site or 90 min remote.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">04</span> <span>Structured readout with measured deltas.</span></li>
              </ol>
            </div>

            <div className="card p-4 text-[12px] text-muted dark:text-muted-dark leading-relaxed">
              Your request will appear as a tracked ticket under <strong className="text-ink dark:text-ink-dark font-medium">Support</strong>. You'll receive email updates at <span className="font-mono text-ink dark:text-ink-dark">{user?.email}</span>.
            </div>

            <button
              type="submit"
              disabled={interest.length === 0}
              className="btn-accent w-full h-10 disabled:opacity-50"
            >
              <Send size={14} /> Send request
            </button>
            {interest.length === 0 && <p className="text-[11px] text-faint dark:text-faint-dark text-center">Pick at least one tool</p>}
          </aside>
        </form>
      )}
    </div>
  )
}
