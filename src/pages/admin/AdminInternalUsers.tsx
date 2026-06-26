import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { assignableRoles, can } from '../../lib/permissions'
import { Spinner } from '../../components/ui'
import { UsersPanel } from '../../components/UsersPanel'
import type { Role } from '../../lib/types'

const INTERNAL_ROLES: Role[] = ['super_admin', 'admin', 'support_engineer']

export default function AdminInternalUsers() {
  const { user } = useAuth()
  const { users, ready, refresh } = useData()

  if (!ready) return <Spinner />

  const internalUsers = users.filter((u) => u.userType === 'internal')
  const roleChoices = assignableRoles(user).filter((r) => INTERNAL_ROLES.includes(r))

  return (
    <UsersPanel
      eyebrow="Internal"
      title="Internal Users"
      description="Sigenic internal staff with access to the partner portal back office."
      users={internalUsers}
      roleChoices={roleChoices}
      canManage={can(user, 'manage_internal_users')}
      refresh={refresh}
      companyId={user?.companyId}
      userType="internal"
      addLabel="Add internal user"
    />
  )
}
