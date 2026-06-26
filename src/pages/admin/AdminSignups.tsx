import { useMemo } from 'react'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { Spinner } from '../../components/ui'
import { UsersPanel } from '../../components/UsersPanel'

/**
 * Internal review surface for self-service sign-ups (client feedback 2026-06).
 * Lists every pending registrant (and the rejected history) regardless of company —
 * the catch-all for new-company requests and any pending user a company admin hasn't
 * gotten to yet. Approve/Reject actions live in the shared UsersPanel row.
 */
export default function AdminSignups() {
  const { user } = useAuth()
  const { users, ready, refresh } = useData()

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === 'pending' || u.status === 'rejected'),
    [users],
  )

  if (!ready) return <Spinner />

  return (
    <UsersPanel
      eyebrow="Sign-ups"
      title="Sign-up requests"
      description="Self-service sign-ups awaiting approval, plus the rejected history. Approving sends the user a link to set their password; rejecting keeps the record but blocks access."
      users={pendingUsers}
      canManage={false}
      refresh={refresh}
      companyId={user?.companyId}
      emptyHint="No sign-ups to review."
    />
  )
}
