import { useState } from 'react'
import { Check, KeyRound, Plus, Power, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { approveUserApi, createUserApi, deleteUserApi, rejectUserApi, resetPasswordApi, updateUserApi } from '../lib/api'
import { canApproveSignup, roleLabel } from '../lib/permissions'
import { PageHeader } from './PageHeader'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { Field, EmptyState, useToast } from './ui'
import { USER_STATUS_LABEL, USER_STATUS_TONE } from '../lib/constants'
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
  roleChoices = [],
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
  /** Roles offered in the invite modal. Only used when canManage is true. */
  roleChoices?: Role[]
  canManage: boolean
  refresh: () => Promise<void>
  companyId?: string | null
  userType?: UserType
  avatarVariant?: 'ink' | 'accent' | 'faint'
  addLabel?: string
  readonlyNote?: string
  emptyHint?: string
}) {
  const { user: currentUser } = useAuth()
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
      toast.push(`Invite sent to ${email.trim()} — they'll set their own password.`)
      setOpen(false)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not invite user.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Run a row action with consistent busy/error/toast handling, skipping the busy
   * spin when the action returns false (e.g. a window.confirm the user cancelled).
   * The action does its own refresh when it needs to — toggleStatus refreshes, the
   * password-reset doesn't, etc.
   */
  const runRowAction = async (
    u: User,
    fallbackError: string,
    action: () => Promise<string | false>,
  ) => {
    setBusyId(u.id)
    try {
      const success = await action()
      if (success !== false) toast.push(success)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : fallbackError, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const toggleStatus = (u: User) =>
    runRowAction(u, 'Could not update status.', async () => {
      const next = u.status === 'active' ? 'inactive' : 'active'
      // touch: false → keep the row in place under the default update-time sort after a toggle.
      await updateUserApi(u.id, { status: next }, { touch: false })
      await refresh()
      return `${u.fullName} set to ${next}.`
    })

  const resetPassword = (u: User) =>
    runRowAction(u, 'Could not send reset link.', async () => {
      if (!window.confirm(`Email ${u.fullName} a single-use link to set a new password?`)) return false
      await resetPasswordApi(u.id)
      return `Reset link sent to ${u.email}.`
    })

  const removeUser = (u: User) =>
    runRowAction(u, 'Could not delete user.', async () => {
      if (!window.confirm(`Permanently delete ${u.fullName}? This removes their account and portal access. Past records are kept but no longer attributed to them. This cannot be undone.`)) return false
      await deleteUserApi(u.id)
      await refresh()
      return `${u.fullName} deleted.`
    })

  const approveSignup = (u: User) =>
    runRowAction(u, 'Could not approve sign-up.', async () => {
      if (!window.confirm(`Approve ${u.fullName}'s sign-up as ${roleLabel(u.role)}? They'll receive an email link to set their password.`)) return false
      await approveUserApi(u.id)
      await refresh()
      return `${u.fullName} approved — set-password link sent.`
    })

  const rejectSignup = (u: User) =>
    runRowAction(u, 'Could not reject sign-up.', async () => {
      const reason = window.prompt(`Reject ${u.fullName}'s sign-up? Optionally enter a reason (sent to them).`, '')
      if (reason === null) return false
      await rejectUserApi(u.id, { reason: reason || undefined })
      await refresh()
      return `${u.fullName}'s sign-up rejected.`
    })

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
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <Badge tone={USER_STATUS_TONE[u.status]} dot>
          {USER_STATUS_LABEL[u.status] ?? u.status}
        </Badge>
      ),
    },
  ]

  // Action column. We always render it whenever the viewer could either *manage*
  // ordinary users or *approve* a pending sign-up they can see — pending rows show
  // Approve/Reject, every other row shows the usual deactivate/reset/delete trio
  // (gated on canManage). A row that yields nothing renders an empty cell.
  const canShowActions =
    canManage || users.some((u) => u.status === 'pending' && canApproveSignup(currentUser, u.companyId, u.role))
  if (canShowActions) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => {
        if (u.status === 'pending') {
          if (!canApproveSignup(currentUser, u.companyId, u.role)) return null
          return (
            <div className="flex items-center justify-end gap-1">
              <button className="btn-ghost text-xs text-success hover:text-success" disabled={busyId === u.id} onClick={() => approveSignup(u)}>
                <Check size={13} /> Approve
              </button>
              <button className="btn-ghost text-xs text-danger hover:text-danger" disabled={busyId === u.id} onClick={() => rejectSignup(u)}>
                <X size={13} /> Reject
              </button>
            </div>
          )
        }
        if (!canManage) return null
        return (
          <div className="flex items-center justify-end gap-1">
            <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => toggleStatus(u)}>
              <Power size={13} /> {u.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
            <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => resetPassword(u)}>
              <KeyRound size={13} /> Reset password
            </button>
            {u.id !== currentUser?.id && (
              <button className="btn-ghost text-xs text-danger hover:text-danger" disabled={busyId === u.id} onClick={() => removeUser(u)}>
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        )
      },
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
