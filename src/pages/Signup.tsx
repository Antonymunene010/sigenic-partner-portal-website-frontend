import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { getSignupCompanies, signup, type SignupCompanyChoice } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { Field } from '../components/ui'

/**
 * Self-service sign-up (client feedback 2026-06). The user picks their company from
 * an existing list, or chooses "My company is not listed" to request a new company —
 * Sigenic admins approve the new-company case, a company admin approves the join-
 * existing case. The request lands in the `pending` queue server-side; the password
 * is only set after approval, via the normal invite/reset-password link emailed then.
 */
export default function Signup() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<SignupCompanyChoice[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  /** '' = no selection yet, '__new__' = "My company is not listed", otherwise an id. */
  const [companyChoice, setCompanyChoice] = useState<string>('')
  const [newCompany, setNewCompany] = useState<{
    name: string
    type: 'distributor' | 'customer'
    country: string
    website: string
  }>({ name: '', type: 'customer', country: '', website: '' })
  const editNewCompany = (patch: Partial<typeof newCompany>) => setNewCompany((s) => ({ ...s, ...patch }))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSignupCompanies()
      .then((r) => {
        if (!cancelled) setCompanies(r.companies)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load companies.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const wantsNewCompany = companyChoice === '__new__'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!email.trim()) return setError('Please enter your work email.')
    if (!companyChoice) return setError('Select your company, or choose "My company is not listed".')
    if (wantsNewCompany && !newCompany.name.trim()) return setError('Enter your company name.')

    setBusy(true)
    try {
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        ...(wantsNewCompany
          ? {
              newCompany: {
                companyName: newCompany.name.trim(),
                companyType: newCompany.type,
                country: newCompany.country.trim() || undefined,
                website: newCompany.website.trim() || undefined,
              },
            }
          : { companyId: companyChoice }),
      })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your sign-up. Please try again.')
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
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Sign-up received</h2>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
            Thanks, {fullName.split(' ')[0] || 'there'}. Your request is awaiting approval by{' '}
            {wantsNewCompany ? 'the Sigenic team' : 'a company administrator'}.
          </p>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark text-pretty">
            We've sent a confirmation to <span className="text-emphasis">{email}</span>. Once approved, you'll receive a
            separate email with a link to set your password.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="btn-accent w-full mt-6">
            Back to sign in <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
          <p className="mt-1 text-sm text-muted dark:text-muted-dark">
            Sign up to request access to the Sigenic Partner Portal.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Full name">
              <input
                className="input"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Tan"
                required
              />
            </Field>

            <Field label="Work email">
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </Field>

            <Field label="Company" hint={loadError ? 'Could not load existing companies — request a new one below.' : undefined}>
              <select
                className="select"
                value={companyChoice}
                onChange={(e) => setCompanyChoice(e.target.value)}
                disabled={!companies && !loadError}
                required
              >
                <option value="" disabled>
                  {companies ? 'Select your company…' : loadError ? 'Companies unavailable' : 'Loading…'}
                </option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
                <option value="__new__">My company is not listed — request a new one</option>
              </select>
            </Field>

            {wantsNewCompany && (
              <div className="rounded-md border border-line dark:border-line-dark bg-raised dark:bg-raised-dark p-4 space-y-3">
                <p className="text-xs text-muted dark:text-muted-dark">
                  New companies are reviewed and approved by the Sigenic team.
                </p>
                <Field label="Company name">
                  <input
                    className="input"
                    value={newCompany.name}
                    onChange={(e) => editNewCompany({ name: e.target.value })}
                    placeholder="Acme Semiconductor"
                    required
                  />
                </Field>
                <Field label="Company type">
                  <select
                    className="select"
                    value={newCompany.type}
                    onChange={(e) => editNewCompany({ type: e.target.value as 'distributor' | 'customer' })}
                  >
                    <option value="customer">Customer</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </Field>
                <Field label="Country / region" hint="Optional">
                  <input className="input" value={newCompany.country} onChange={(e) => editNewCompany({ country: e.target.value })} placeholder="Singapore" />
                </Field>
                <Field label="Company website" hint="Optional">
                  <input className="input" value={newCompany.website} onChange={(e) => editNewCompany({ website: e.target.value })} placeholder="acme.com" />
                </Field>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button className="btn-accent w-full" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit sign-up'} <ArrowRight size={15} />
            </button>

            <p className="text-xs text-muted dark:text-muted-dark text-center">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-emphasis hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </>
      )}
    </AuthShell>
  )
}
