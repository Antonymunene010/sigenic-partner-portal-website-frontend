import { useMemo, useState } from 'react'
import { Check, KeyRound, Mail, Pencil, Plus, Power, Trash2, X } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { approveUserApi, createUserApi, deleteUserApi, rejectUserApi, resendInviteApi, resetPasswordApi, updateUserApi } from '../lib/api'
import { canApproveSignup, primaryAdminRoleForType, plainUserRoleForType, roleLabel } from '../lib/permissions'
import { PageHeader } from './PageHeader'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { Field, EmptyState, useToast } from './ui'
import { USER_STATUS_LABEL, USER_STATUS_TONE } from '../lib/constants'
import type { Company, Role, User, UserType } from '../lib/types'

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
  companies,
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
  /**
   * When provided, the table shows a Company column and the invite modal lets the
   * admin pick which company to invite the user into (the cross-company "All
   * Company Users" view). When omitted, the panel operates against a single
   * `companyId` like before.
   */
  companies?: Company[]
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
  // Only used in the cross-company "All Company Users" mode (companies prop set).
  const [pickedCompanyId, setPickedCompanyId] = useState<string>('')
  // Edit-name flow — client feedback 2026-06-27: admins should be able to fix a
  // mistyped name without deleting and re-inviting the user. We only allow the
  // name (not email/role/company) — those are higher-risk edits and outside the
  // reported pain point.
  const [editing, setEditing] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Sorted company picker options (cross-company mode only).
  const companyOptions = useMemo(
    () => (companies ? [...companies].sort((a, b) => a.companyName.localeCompare(b.companyName)) : []),
    [companies],
  )
  const companyById = useMemo(() => {
    const m = new Map<string, Company>()
    companies?.forEach((c) => m.set(c.id, c))
    return m
  }, [companies])

  // Roles offered for the currently picked company in cross-company mode — derived
  // from the company's type so the admin can't invite a customer_admin into a
  // distributor org (a constraint canManageUser would reject server-side anyway).
  const pickedCompany = pickedCompanyId ? companyById.get(pickedCompanyId) : undefined
  const effectiveRoleChoices = useMemo<Role[]>(() => {
    if (!companies) return roleChoices
    if (!pickedCompany) return []
    return [primaryAdminRoleForType(pickedCompany.companyType), plainUserRoleForType(pickedCompany.companyType)]
  }, [companies, pickedCompany, roleChoices])

  const openModal = () => {
    setFullName('')
    setEmail('')
    // Cross-company mode: leave both company and role blank so the admin picks a
    // company explicitly. Pre-selecting the alphabetically-first one would silently
    // route invites to the wrong org if the admin doesn't notice. (In cross-company
    // mode roleChoices is empty, so `roleChoices[0] ?? ''` is `''` here too.)
    setPickedCompanyId('')
    setRole(roleChoices[0] ?? '')
    setOpen(true)
  }

  // In cross-company mode the role choices depend on the picked company — keep
  // the selected role in sync so we never submit an option the picker doesn't show.
  const onCompanyPick = (id: string) => {
    setPickedCompanyId(id)
    const c = companyById.get(id)
    if (c) setRole(primaryAdminRoleForType(c.companyType))
  }

  const openEdit = (u: User) => {
    setEditing(u)
    setEditName(u.fullName)
  }

  const submitEdit = async () => {
    if (!editing) return
    const name = editName.trim()
    if (!name) {
      toast.push('Name is required.', 'error')
      return
    }
    if (name === editing.fullName) {
      setEditing(null)
      return
    }
    setEditSubmitting(true)
    try {
      await updateUserApi(editing.id, { fullName: name })
      await refresh()
      toast.push(`${editing.fullName} renamed to ${name}.`)
      setEditing(null)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Could not update user.', 'error')
    } finally {
      setEditSubmitting(false)
    }
  }

  const submit = async () => {
    const crossCompany = !!companies
    if (!fullName.trim() || !email.trim() || !role || (crossCompany && !pickedCompanyId)) {
      toast.push(crossCompany ? 'Company, name, email and role are required.' : 'Name, email and role are required.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const targetCompanyId = crossCompany ? pickedCompanyId : (companyId ?? undefined)
      await createUserApi({ fullName: fullName.trim(), email: email.trim(), role, companyId: targetCompanyId, userType })
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
      // Log the raw error so production issues are diagnosable from devtools even
      // when the surfaced toast only carries the human-readable summary.
      console.error('[UsersPanel] row action failed:', e)
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

  // Only meaningful for users that haven't activated yet (status='invited'). The
  // server enforces the same gate and refuses with a clear message otherwise.
  const resendInvite = (u: User) =>
    runRowAction(u, 'Could not resend invite.', async () => {
      if (!window.confirm(`Resend the original invite link to ${u.fullName} (${u.email})?`)) return false
      await resendInviteApi(u.id)
      return `Invite link resent to ${u.email}.`
    })

  const removeUser = (u: User) =>
    runRowAction(u, 'Could not delete user.', async () => {
      if (!window.confirm(`Permanently delete ${u.fullName}? This removes their account and portal access. Past records are kept but no longer attributed to them. This cannot be undone.`)) return false
      await deleteUserApi(u.id)
      // Refresh is a UX touch — if hydrate hiccups we still want the success toast
      // and the row to clear from the list on the next natural refresh, rather than
      // silently swallowing the confirmation.
      await refresh().catch(() => {})
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
    ...(companies
      ? (() => {
          const companyName = (u: User) => (u.companyId && companyById.get(u.companyId)?.companyName) || ''
          return [
            {
              key: 'company',
              header: 'Company',
              sortAccessor: companyName,
              render: (u: User) => (
                <span className="text-muted dark:text-muted-dark">{companyName(u) || '—'}</span>
              ),
            } as Column<User>,
          ]
        })()
      : []),
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
            <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => openEdit(u)}>
              <Pencil size={13} /> Edit name
            </button>
            {u.status === 'invited' ? (
              <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => resendInvite(u)}>
                <Mail size={13} /> Resend invite
              </button>
            ) : (
              <button className="btn-ghost text-xs" disabled={busyId === u.id} onClick={() => toggleStatus(u)}>
                <Power size={13} /> {u.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            )}
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
          {companies && (
            <Field label="Company" htmlFor="up-company" hint="The new user will be invited into this company">
              <select id="up-company" className="select" value={pickedCompanyId} onChange={(e) => onCompanyPick(e.target.value)}>
                <option value="">Pick a company…</option>
                {companyOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Full name" htmlFor="up-name">
            <input id="up-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Tan" />
          </Field>
          <Field label="Email" htmlFor="up-email">
            <input id="up-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
          </Field>
          <Field label="Role" htmlFor="up-role">
            <select id="up-role" className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {effectiveRoleChoices.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit user name"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)} disabled={editSubmitting}>
              Cancel
            </button>
            <button className="btn-accent" onClick={submitEdit} disabled={editSubmitting}>
              {editSubmitting ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <Field label="Full name" htmlFor="up-edit-name">
              <input
                id="up-edit-name"
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </Field>
            <p className="text-xs text-muted dark:text-muted-dark">
              Updates the display name for <span className="font-medium">{editing.email}</span>. To change the email
              address itself, delete the account and invite a fresh one.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
