import { useState } from 'react'
import { KeyRound, Plus, Power } from 'lucide-react'
import { createUserApi, resetPasswordApi, updateUserApi } from '../lib/api'
import { roleLabel } from '../lib/permissions'
import { PageHeader } from './PageHeader'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { Field, EmptyState, useToast } from './ui'
import { USER_STATUS_TONE } from '../lib/constants'
import type { Role, User, UserType } from '../lib/types'

/**
 * Shared user-roster panel for both the customer/distributor "Team" page and the
 * internal-staff page. They differ only in the user set, the assignable roles,
 * and labels — everything else (table, invite modal, status/password actions)
 * is identical.
 */
export function UsersPanel({
  eyebrow,
  title,
  description,
  users,
  roleChoices,
  canManage,
  refresh,
  companyId,
  userType,
  avatarVariant = 'ink',
  addLabel = 'Invite user',
  readonlyNote,
  emptyHint,
}: {
  eyebrow: string
  title: string
  description: string
  users: User[]
  roleChoices: Role[]
  canManage: boolean
  refresh: () => Promise<void>
  companyId?: string | null
  userType?: UserType
  avatarVariant?: 'ink' | 'accent' | 'faint'
  addLabel?: string
  readonlyNote?: string
  emptyHint?: string
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | ''>(roleChoices[0] ?? '')

  const openModal = () => {
    setFullName('')
    setEmail('')
    setRole(roleChoices[0] ?? '')
    setOpen(true)
  }

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !role) {
      toast.push('Name, email and role are required.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await createUserApi({ fullName: fullName.trim(), email: email.trim(), role, companyId: companyId ?? undefined, userType })
      await refresh()
      toast.push('User invited.')
      setOpen(false)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not invite user.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (u: User) => {
    const next = u.status === 'active' ? 'inactive' : 'active'
    setBusyId(u.id)
    try {
      // touch: false → keep the row in place under the default update-time sort after a toggle.
      await updateUserApi(u.id, { status: next }, { touch: false })
      await refresh()
      toast.push(`${u.fullName} set to ${next}.`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not update status.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const resetPassword = async (u: User) => {
    const password = window.prompt(`Set a new password for ${u.fullName}`)
    if (!password) return
    setBusyId(u.id)
    try {
      await resetPasswordApi(u.id, password)
      toast.push(`Password reset for ${u.fullName}.`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not reset password.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      sortAccessor: (u) => u.fullName,
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={u.fullName} variant={avatarVariant} size="md" />
          <span className="font-medium truncate">{u.fullName}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (u) => <span className="text-muted dark:text-muted-dark">{u.email}</span> },
    { key: 'role', header: 'Role', render: (u) => roleLabel(u.role) },
    { key: 'status', header: 'Status', render: (u) => <Badge tone={USER_STATUS_TONE[u.status]} dot>{u.status}</Badge> },
  ]

  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => toggleStatus(u)}>
            <Power size={13} /> {u.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => resetPassword(u)}>
            <KeyRound size={13} /> Reset password
          </button>
        </div>
      ),
    })
  }

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          canManage ? (
            <button className="btn-accent" onClick={openModal}>
              <Plus size={15} /> {addLabel}
            </button>
          ) : undefined
        }
      />

      {!canManage && readonlyNote && <p className="mb-4 text-sm text-muted dark:text-muted-dark">{readonlyNote}</p>}

      <DataTable<User>
        columns={columns}
        rows={users}
        empty={<EmptyState title="No users yet" hint={emptyHint ?? 'Invite teammates to give them portal access.'} />}
        defaultSort={{ key: 'updatedAt', dir: 'desc' }}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={addLabel}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn-accent" onClick={submit} disabled={submitting}>
              {submitting ? 'Inviting…' : 'Send invite'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="up-name">
            <input id="up-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Tan" />
          </Field>
          <Field label="Email" htmlFor="up-email">
            <input id="up-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </Field>
          <Field label="Role" htmlFor="up-role">
            <select id="up-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roleChoices.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
