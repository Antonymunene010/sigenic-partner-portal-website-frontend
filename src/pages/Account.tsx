import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { changePassword } from '../lib/api'
import { roleLabel } from '../lib/permissions'
import { fmtDate } from '../lib/format'
import { USER_STATUS_TONE } from '../lib/constants'
import { PageHeader } from '../components/PageHeader'
import { Card, Field, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { Avatar } from '../components/Avatar'
import { DemoBadge } from '../components/DemoBadge'
import { DescRow } from '../components/DescRow'

export default function Account() {
  const { user } = useAuth()
  const { push } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirm) {
      push('New password and confirmation do not match.', 'error')
      return
    }
    if (newPassword.length < 4) {
      push('New password must be at least 4 characters.', 'error')
      return
    }
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      push('Password updated.', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update password.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Your profile" title="Account" />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Profile">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line dark:border-line-dark">
            <Avatar name={user.fullName} variant="accent" size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">{user.fullName}</span>
                <DemoBadge email={user.email} />
              </div>
              <div className="text-xs text-muted dark:text-muted-dark truncate">{user.email}</div>
            </div>
          </div>
          <dl className="space-y-2.5 text-sm">
            <DescRow k="Role" v={roleLabel(user.role)} />
            <DescRow k="User type" v={user.userType} />
            <DescRow k="Company" v={user.companyName ?? '—'} />
            <DescRow k="Status" v={<Badge tone={USER_STATUS_TONE[user.status]}>{user.status}</Badge>} />
            <DescRow k="Member since" v={fmtDate(user.createdAt)} />
          </dl>
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><KeyRound size={14} /> Change password</span>}>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Current password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="New password" hint="At least 4 characters.">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </Field>
            <button className="btn-accent" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
