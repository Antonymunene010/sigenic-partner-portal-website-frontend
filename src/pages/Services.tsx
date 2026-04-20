import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Compass, LineChart, MessagesSquare, Send } from 'lucide-react'
import { load, nextTicketId, save } from '../lib/storage'
import type { ProductArea, Ticket, TicketCategory } from '../lib/types'
import { seedTickets } from '../lib/seed'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../lib/auth'
import { PRODUCT_AREAS as AREAS } from '../lib/constants'
import { makeSystemMsg, makeUserMsg, systemRouted } from '../lib/tickets'

type IntakeKind = Extract<TicketCategory, 'demo' | 'onboarding' | 'data' | 'consulting'>

const INTAKES: {
  id: IntakeKind
  title: string
  blurb: string
  icon: typeof CalendarClock
  contextPlaceholder: string
}[] = [
  {
    id: 'demo',
    title: 'Demo request',
    blurb: 'Evaluate a tool or capability on-site or remotely.',
    icon: CalendarClock,
    contextPlaceholder: 'Which tool / capability? Target use case, facility, preferred timing…',
  },
  {
    id: 'onboarding',
    title: 'Feature onboarding',
    blurb: 'Get hands-on enablement for a new Sigenic feature or module.',
    icon: Compass,
    contextPlaceholder: 'Which feature? Who needs training? Timeline and prerequisites…',
  },
  {
    id: 'data',
    title: 'Data analysis',
    blurb: 'Ask the Sigenic team for a bespoke analysis of your telemetry.',
    icon: LineChart,
    contextPlaceholder: 'Which signals / lots / time windows? What question are you trying to answer?',
  },
  {
    id: 'consulting',
    title: 'Consulting / advisory',
    blurb: 'Scope a pilot, reference architecture, or strategic review.',
    icon: MessagesSquare,
    contextPlaceholder: 'Scope, timeline, constraints, and who will be involved on your side.',
  },
]

export default function Services() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [kind, setKind] = useState<IntakeKind>('demo')
  const [subject, setSubject] = useState('')
  const [context, setContext] = useState('')
  const [area, setArea] = useState<ProductArea>('Lithography')
  const [format, setFormat] = useState<'on-site' | 'remote' | 'either'>('either')
  const [timeframe, setTimeframe] = useState<'2w' | '1m' | 'q'>('2w')
  const [done, setDone] = useState<string | null>(null)

  const active = INTAKES.find((i) => i.id === kind)!

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!context.trim()) return
    const tickets = load<Ticket[]>('tickets', seedTickets)
    const id = nextTicketId()
    const now = new Date().toISOString()
    const tf = timeframe === '2w' ? 'within 2 weeks' : timeframe === '1m' ? 'within 1 month' : 'this quarter'
    const body = [
      `${active.title} · ${area}`,
      '',
      context.trim(),
      '',
      `Preferred format: ${format}`,
      `Timeframe: ${tf}`,
    ].join('\n')
    const ticket: Ticket = {
      id,
      subject: subject.trim() || `${active.title} · ${area}`,
      status: 'open',
      priority: 'normal',
      category: kind,
      productArea: area,
      customerImpact: 'medium',
      requester: user?.name ?? 'You',
      tags: [kind, area.toLowerCase()],
      createdAt: now,
      updatedAt: now,
      source: 'portal',
      messages: [
        makeUserMsg(user?.name ?? 'You', body, now),
        makeSystemMsg(systemRouted(kind, 'A rep will reach out within 1 business day.'), now),
      ],
    }
    save('tickets', [ticket, ...tickets])
    setDone(id)
  }

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => nav(`/app/support/${done}`), 1000)
    return () => clearTimeout(t)
  }, [done, nav])

  return (
    <div>
      <PageHeader
        eyebrow="Service requests · structured intake"
        title="Request a service"
        description="Use this intake for anything beyond a support ticket — demos, onboarding, analysis, consulting. Requests route to the right Sigenic team and become tracked tickets."
      />

      {done ? (
        <div className="card p-10 text-center max-w-md mx-auto animate-fade-up">
          <div className="w-10 h-10 mx-auto rounded-full bg-success/10 text-success flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div className="mt-3 text-[17px] font-semibold tracking-tight">Request {done} sent</div>
          <div className="mt-1 text-[13px] text-muted dark:text-muted-dark">Opening ticket…</div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="card p-5">
              <label className="label">What do you need?</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {INTAKES.map((i) => {
                  const on = kind === i.id
                  return (
                    <button
                      type="button"
                      key={i.id}
                      onClick={() => setKind(i.id)}
                      className={`text-left rounded-md border px-3 py-3 transition flex items-start gap-3 ${
                        on
                          ? 'border-ink dark:border-ink-dark bg-raised/70 dark:bg-raised-dark/70'
                          : 'border-line dark:border-line-dark hover:border-line-strong dark:hover:border-line-strong-dark'
                      }`}
                      aria-pressed={on}
                    >
                      <i.icon size={16} className={`mt-0.5 shrink-0 ${on ? 'text-accent' : 'text-muted dark:text-muted-dark'}`} />
                      <span>
                        <span className="text-[13.5px] font-medium block">{i.title}</span>
                        <span className="text-[11.5px] text-muted dark:text-muted-dark leading-snug block mt-0.5">{i.blurb}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <div>
                <label className="label" htmlFor="subject">Subject (optional)</label>
                <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={`${active.title} · short summary`} />
              </div>
              <div>
                <label className="label" htmlFor="context">Context</label>
                <textarea id="context" className="textarea min-h-[120px]" placeholder={active.contextPlaceholder} value={context} onChange={(e) => setContext(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="area">Product area</label>
                <select id="area" className="select" value={area} onChange={(e) => setArea(e.target.value as ProductArea)}>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="card p-5">
              <label className="label">Preferred format</label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['on-site', 'remote', 'either'] as const).map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`h-10 rounded-md text-[13px] capitalize border transition ${
                      format === f ? 'border-ink dark:border-ink-dark bg-raised dark:bg-raised-dark font-medium' : 'border-line dark:border-line-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark'
                    }`}
                    aria-pressed={format === f}
                  >
                    {f}
                  </button>
                ))}
              </div>
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
                    aria-pressed={timeframe === t.id}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <active.icon size={14} className="text-accent" />
                <div className="text-[13px] font-medium">What to expect</div>
              </div>
              <ol className="mt-3 space-y-2.5 text-[12.5px] text-muted dark:text-muted-dark leading-relaxed">
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">01</span> <span>Sigenic team confirms within 1 business day.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">02</span> <span>Scoping conversation + logistics checklist.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">03</span> <span>Execution — on-site or remote, per preference.</span></li>
                <li className="flex gap-3"><span className="font-mono text-faint dark:text-faint-dark">04</span> <span>Structured readout with measurable outcomes.</span></li>
              </ol>
            </div>

            <div className="card p-4 text-[12px] text-muted dark:text-muted-dark leading-relaxed">
              Your request will appear as a tracked ticket under <strong className="text-ink dark:text-ink-dark font-medium">Support</strong>. You'll receive email updates at <span className="font-mono text-ink dark:text-ink-dark">{user?.email}</span>.
            </div>

            <button type="submit" disabled={!context.trim()} className="btn-accent w-full h-10 disabled:opacity-50">
              <Send size={14} /> Send request
            </button>
          </aside>
        </form>
      )}
    </div>
  )
}
