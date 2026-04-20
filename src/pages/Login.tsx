import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { WordMark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

export default function Login() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('partner@demo.com')
  const [password, setPassword] = useState('demo')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) nav('/app', { replace: true })
  }, [user, nav])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    // small simulated delay for polish
    setTimeout(() => {
      const res = login(email, password)
      if (res.ok) nav('/app', { replace: true })
      else {
        setError(res.error ?? 'Login failed')
        setLoading(false)
      }
    }, 350)
  }

  const quick = (who: 'partner@demo.com' | 'admin@demo.com') => {
    setEmail(who)
    setPassword('demo')
    setError(null)
    setLoading(true)
    setTimeout(() => {
      const res = login(who, 'demo')
      if (res.ok) nav('/app', { replace: true })
      else {
        setError(res.error ?? 'Login failed')
        setLoading(false)
      }
    }, 250)
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas dark:bg-canvas-dark">
      {/* Marketing side */}
      <aside className="relative hidden md:flex md:w-[52%] lg:w-[55%] bg-ink text-canvas dark:bg-surface-dark dark:text-ink-dark overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div
          className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle at center, #CCFF00 0%, transparent 60%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[520px] h-[520px] rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle at center, #CCFF00 0%, transparent 60%)' }}
        />
        <div className="relative z-10 flex flex-col justify-between p-10 lg:p-14 w-full">
          <div className="flex items-center gap-3">
            <div className="text-canvas dark:text-ink-dark">
              <WordMark />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] opacity-60 border-l border-white/20 pl-3 ml-1">
              Partner Portal
            </span>
          </div>

          <div className="max-w-lg">
            <div className="eyebrow mb-5 text-white/60 before:bg-white/30">Precision foundry · Singapore</div>
            <h1 className="text-[44px] lg:text-[56px] leading-[0.98] font-semibold tracking-tightest text-balance">
              The quiet{' '}
              <span className="font-serif italic font-normal text-accent">instruments</span>
              <br />
              behind your yield.
            </h1>
            <p className="mt-5 text-[15px] lg:text-base text-white/70 text-pretty leading-relaxed">
              Submit support, request demos, manage billing, and model cost savings — one
              portal for everything we do together.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-5 max-w-md">
              {[
                { k: 'Yield lift', v: '+38%', n: 'avg across APAC partners' },
                { k: 'Downtime', v: '−72%', n: 'predictive maintenance' },
                { k: 'Payback', v: '4.1 mo', n: 'median engagement' },
              ].map((s) => (
                <div key={s.k}>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/50">
                    {s.k}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight num text-accent">
                    {s.v}
                  </div>
                  <div className="mt-1 text-[10px] text-white/40 leading-tight">{s.n}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.12em] text-white/40">
            <span>Region · SG-1 · 1 Fusionopolis Way</span>
            <span>v0.1 · demo build</span>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <section className="flex-1 flex flex-col min-h-screen">
        <div className="flex items-center justify-between p-5 md:hidden border-b border-line dark:border-line-dark">
          <WordMark />
          <ThemeToggle />
        </div>
        <div className="hidden md:flex items-center justify-end p-5">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">
            <div className="eyebrow mb-4">Sign in to continue</div>
            <h2 className="text-[28px] font-semibold tracking-tightest leading-tight">
              Welcome back.
            </h2>
            <p className="mt-1.5 text-[14px] text-muted dark:text-muted-dark">
              Enter your portal credentials to access your workspace.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <label className="label">Work email</label>
                <input
                  type="email"
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label flex justify-between">
                  <span>Password</span>
                  <a className="text-[11px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark" href="#">
                    Forgot?
                  </a>
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="text-[12px] text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-accent w-full h-10 disabled:opacity-60">
                {loading ? 'Signing in…' : (
                  <>
                    Sign in <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 pt-6 border-t border-line dark:border-line-dark">
              <div className="eyebrow mb-3">Demo shortcuts</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => quick('partner@demo.com')}
                  className="group text-left rounded-md border border-line dark:border-line-dark px-3 py-2.5 hover:border-ink dark:hover:border-ink-dark transition"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={12} className="text-muted dark:text-muted-dark group-hover:text-accent" />
                    <div className="text-[12px] font-medium">Partner</div>
                  </div>
                  <div className="text-[10px] font-mono text-faint dark:text-faint-dark mt-0.5">
                    partner@demo.com
                  </div>
                </button>
                <button
                  onClick={() => quick('admin@demo.com')}
                  className="group text-left rounded-md border border-line dark:border-line-dark px-3 py-2.5 hover:border-ink dark:hover:border-ink-dark transition"
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-muted dark:text-muted-dark group-hover:text-accent" />
                    <div className="text-[12px] font-medium">Admin</div>
                  </div>
                  <div className="text-[10px] font-mono text-faint dark:text-faint-dark mt-0.5">
                    admin@demo.com
                  </div>
                </button>
              </div>
              <p className="mt-3 text-[11px] text-faint dark:text-faint-dark flex items-center gap-1.5">
                <Zap size={11} /> Any password works in demo mode.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 text-[11px] font-mono uppercase tracking-[0.12em] text-faint dark:text-faint-dark border-t border-line dark:border-line-dark flex items-center justify-between">
          <span>© 2026 Axiom Foundry</span>
          <span>Privacy · Terms</span>
        </div>
      </section>
    </div>
  )
}
