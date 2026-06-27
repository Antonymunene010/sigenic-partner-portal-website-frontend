import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { resetPassword } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { Field, PasswordInput } from '../components/ui'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Missing token is fixed by the URL, not user action — handle it up front, not in the render branch.
  if (!token) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight">Invalid reset link</h2>
        <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
          This link is missing its reset token. Request a fresh link and try again.
        </p>
        <Link to="/forgot-password" className="btn-accent w-full mt-6">
          Request a new link <ArrowRight size={15} />
        </Link>
      </AuthShell>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {done ? (
        <div>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-emphasis">
            <CheckCircle2 size={22} />
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Password updated</h2>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="btn-accent w-full mt-6">
            Go to sign in <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">Set a new password for your Sigenic account.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="New password">
              <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" required />
            </Field>
            <Field label="Confirm new password">
              <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" required />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn-accent w-full" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'} <ArrowRight size={15} />
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}
