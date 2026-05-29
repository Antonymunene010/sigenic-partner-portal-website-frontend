import { useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { assignableRoles, can } from '../lib/permissions'
import { Spinner } from '../components/ui'
import { UsersPanel } from '../components/UsersPanel'

export default function UserManagement() {
  const { user } = useAuth()
  const { users, company, ready, refresh } = useData()
  const roleChoices = useMemo(() => assignableRoles(user), [user])

  if (!ready) return <Spinner />

  return (
    <UsersPanel
      eyebrow="Team"
      title="User management"
      description={company ? `Manage the people in ${company.companyName} who can access the portal.` : 'Manage the people in your company who can access the portal.'}
      users={users}
      roleChoices={roleChoices}
      canManage={can(user, 'manage_company_users')}
      refresh={refresh}
      companyId={company?.id}
      readonlyNote="Only company admins can manage users."
    />
  )
}
