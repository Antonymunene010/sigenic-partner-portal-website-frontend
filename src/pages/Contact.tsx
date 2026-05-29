import { useState } from 'react'
import { ArrowRight, CheckCircle2, Send } from 'lucide-react'
import { submitPublicRequest } from '../lib/api'
import { Card, Field } from '../components/ui'

type RequestType = 'demo' | 'consultation'

const INTEREST_TYPES = [
  'ROI calculator',
  'Support & ticketing',
  'Knowledge base',
  'Distributor partnership',
  'Other',
]

const REQUEST_OPTIONS: { value: RequestType; label: string; blurb: string }[] = [
  { value: 'demo', label: 'Book a demo', blurb: 'See the platform with one of our engineers.' },
  { value: 'consultation', label: 'Request a consultation', blurb: 'Scope a fit for your fab or distribution network.' },
]

export default function Contact() {
  const [requestType, setRequestType] = useState<RequestType>('demo')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [interestType, setInterestType] = useState(INTEREST_TYPES[0])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const reset = () => {
    setRequestType('demo')
    setName('')
    setEmail('')
    setCompany('')
    setRole('')
    setInterestType(INTEREST_TYPES[0])
    setMessage('')
    setError(null)
    setDone(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const context = [message.trim(), role ? `Role: ${role}` : '', company ? `Company: ${company}` : '']
        .filter(Boolean)
        .join('\n\n')
      await submitPublicRequest({
        contactName: name.trim(),
        contactEmail: email.trim(),
        title: `${interestType || 'Demo'} — ${company || 'Unknown'}`,
        description: context,
        requestType,
        interestType,
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <p className="eyebrow">Get in touch</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Talk to the Sigenic team</h1>
      <p className="mt-3 text-muted dark:text-muted-dark text-pretty">
        Tell us what you'd like to explore — a guided <span className="text-emphasis">demo</span> or a
        scoping <span className="text-emphasis">consultation</span> — and we'll get back to you within one business day.
      </p>

      {done ? (
        <Card className="mt-8 text-center" padded>
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-emphasis">
              <CheckCircle2 size={26} />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Thanks — request received</h2>
              <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
                We've logged your {requestType === 'demo' ? 'demo' : 'consultation'} request. A member of our team will
                reach out to <span className="text-emphasis">{email}</span> shortly.
              </p>
            </div>
            <button type="button" className="btn-outline" onClick={reset}>
              Submit another request
            </button>
          </div>
        </Card>
      ) : (
        <form onSubmit={submit} className="mt-8">
          <Card padded>
            <Field label="What can we help with?">
              <div className="grid sm:grid-cols-2 gap-2">
                {REQUEST_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRequestType(opt.value)}
                    className={`text-left p-3 rounded-md border transition ${requestType === opt.value ? 'border-accent bg-accent/8' : 'border-line dark:border-line-dark hover:bg-raised dark:hover:bg-raised-dark'}`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted dark:text-muted-dark mt-0.5">{opt.blurb}</div>
                  </button>
                ))}
              </div>
            </Field>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <Field label="Full name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Tan" required />
              </Field>
              <Field label="Work email">
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              </Field>
              <Field label="Company">
                <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Semiconductors" required />
              </Field>
              <Field label="Role">
                <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Process Engineering Lead" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Area of interest">
                  <select className="select" value={interestType} onChange={(e) => setInterestType(e.target.value)}>
                    {INTEREST_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Message" hint="Optional — share context, machines/processes, or goals.">
                  <textarea
                    className="textarea min-h-[120px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your fab, current challenges, or what you'd like to see."
                  />
                </Field>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex items-center gap-3">
              <button className="btn-accent" disabled={busy}>
                <Send size={15} /> {busy ? 'Sending…' : 'Send request'} <ArrowRight size={15} />
              </button>
              <span className="text-xs text-muted dark:text-muted-dark">No account needed.</span>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}
