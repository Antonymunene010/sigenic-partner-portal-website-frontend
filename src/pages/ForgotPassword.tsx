import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'
import { requestPasswordReset } from '../lib/api'
import { WordMark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Field } from '../components/ui'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas dark:bg-canvas-dark">
      <div className="flex items-center justify-between p-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
        >
          <ArrowLeft size={16} /> Back to sign in
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <Link to="/" aria-label="Sigenic home" className="inline-block mb-8 transition-opacity hover:opacity-80">
            <WordMark className="h-10" />
          </Link>

          {sent ? (
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-emphasis">
                <MailCheck size={22} />
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">Check your email</h2>
              <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
                If an account exists for <span className="text-emphasis">{email}</span>, we've sent a link to reset your
                password. The link expires in 1 hour.
              </p>
              <p className="mt-4 text-sm text-muted dark:text-muted-dark">
                Didn't get it? Check your spam folder, or{' '}
                <button type="button" onClick={() => setSent(false)} className="font-medium text-emphasis hover:underline">
                  try a different email
                </button>
                .
              </p>
              <Link to="/login" className="btn-outline w-full mt-6">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Forgot your password?</h2>
              <p className="mt-1 text-sm text-muted dark:text-muted-dark">
                Enter the email tied to your account and we'll send you a link to reset it.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Work email">
                  <input
                    className="input"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </Field>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button className="btn-accent w-full" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={15} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
