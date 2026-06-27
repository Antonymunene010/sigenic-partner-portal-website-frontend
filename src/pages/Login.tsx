import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, Mail, Phone } from 'lucide-react'
import { useAuth, takeSessionExpired } from '../lib/auth'
import { WordMark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Field, PasswordInput } from '../components/ui'

const DEMO_ACCOUNTS = [
  { email: 'founder-demo@sigenic.com', label: 'Super Admin · Sigenic' },
  { email: 'admin-demo@sigenic.com', label: 'Admin · Sigenic' },
  { email: 'support-demo@sigenic.com', label: 'Support Engineer · Sigenic' },
  { email: 'admin@apacpartners.com', label: 'Distributor Admin · APAC' },
  { email: 'leo@apacpartners.com', label: 'Distributor User · APAC' },
  { email: 'karen@novacell.sg', label: 'Customer Admin · NovaCell' },
  { email: 'wei@novacell.sg', label: 'Customer User · NovaCell' },
  { email: 'daniel@quantex.com', label: 'Customer Admin · Quantex' },
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Consume the one-shot expiry flag exactly once: useState's initializer runs only
  // on mount, so re-renders don't re-read (and re-clear) sessionStorage. The notice
  // is never updated after mount, so we don't keep the setter.
  const [notice] = useState<string | null>(() =>
    takeSessionExpired() ? 'Your session has expired. Please sign in again.' : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await login(email, password)
    setBusy(false)
    if (res.ok) navigate('/app')
    else setError(res.error ?? 'Login failed.')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas dark:bg-canvas-dark">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-raised dark:bg-raised-dark border-r border-line dark:border-line-dark">
        <Link to="/app" aria-label="Back to portal" className="self-start transition-opacity hover:opacity-80">
          <WordMark className="h-14" />
        </Link>
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold tracking-tightest leading-[1.1] text-balance">
            The operating system for partner interactions with Sigenic.
          </h1>
          <p className="mt-4 text-muted dark:text-muted-dark text-pretty">
            Self-service support, ROI estimation and case studies — under the Sigenic Care program.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              ['+38%', 'yield uplift'],
              ['4.1mo', 'payback'],
              ['$2.4M', 'excursion avoided'],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="text-2xl font-semibold text-emphasis num">{v}</div>
                <div className="text-xs text-muted dark:text-muted-dark mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-faint dark:text-faint-dark">
          <span className="font-mono uppercase tracking-[0.12em]">© 2026 Sigenic</span>
          <address className="contents not-italic">
            <span className="flex items-center gap-1.5">
              <MapPin size={12} className="shrink-0" /> 10 Ubi Crescent, Ubi Techpark, #07-19C, Singapore 408564
            </span>
            <a href="mailto:sigenic_sales@sigenic.com" className="flex items-center gap-1.5 hover:text-ink dark:hover:text-ink-dark transition-colors">
              <Mail size={12} className="shrink-0" /> sigenic_sales@sigenic.com
            </a>
            <a href="tel:+6562700153" className="flex items-center gap-1.5 hover:text-ink dark:hover:text-ink-dark transition-colors">
              <Phone size={12} className="shrink-0" /> +65 6270 0153
            </a>
          </address>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col">
        <div className="flex items-center justify-end p-4">
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted dark:text-muted-dark">Access the Sigenic partner portal.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Work email">
                <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              </Field>
              <Field label="Password">
                <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" required />
              </Field>
              <div className="-mt-1 flex justify-end">
                <Link to="/forgot-password" className="text-xs font-medium text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors">
                  Forgot password?
                </Link>
              </div>
              {notice && !error && <p className="text-sm text-muted dark:text-muted-dark">{notice}</p>}
              {error && <p className="text-sm text-danger">{error}</p>}
              <button className="btn-accent w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} />
              </button>
              <p className="text-xs text-muted dark:text-muted-dark text-center">
                Don't have an account?{' '}
                <Link to="/signup" className="font-medium text-emphasis hover:underline">
                  Sign up
                </Link>
              </p>
            </form>

            <div className="mt-8 pt-5 border-t border-line dark:border-line-dark">
              <p className="stat-label mb-2">Demo accounts · password "demo"</p>
              <div className="grid grid-cols-1 gap-1">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => { setEmail(a.email); setPassword('demo') }}
                    className="text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-raised dark:hover:bg-raised-dark text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition flex items-center justify-between"
                  >
                    <span className="font-medium">{a.label}</span>
                    <span className="font-mono text-faint">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
