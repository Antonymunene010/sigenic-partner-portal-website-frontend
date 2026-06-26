import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { Spinner } from '../../components/ui'
import { UsersPanel } from '../../components/UsersPanel'

/**
 * Sigenic admin/super_admin back-office view of every external (distributor +
 * customer) user across all companies. Closes the gap where internal staff had
 * no UI to manage partner/customer admins — e.g. to resend a failed invite, fix
 * an admin's email, or remove a defunct account — even though canManageUser had
 * always permitted it server-side. Internal Sigenic staff are managed on the
 * separate "Internal Users" page (super_admin-only, per PRD §5.1).
 */
export default function AdminCompanyUsers() {
  const { user } = useAuth()
  const { users, companies, ready, refresh } = useData()

  if (!ready) return <Spinner />

  // External users only — internal Sigenic staff has its own page. We render the
  // company column from the same companies list that powers the invite picker
  // so the two stay in lockstep when a company is renamed.
  const externalUsers = users.filter((u) => u.userType !== 'internal')
  const externalCompanies = companies.filter((c) => c.companyType !== 'sigenic')

  return (
    <UsersPanel
      eyebrow="Partners"
      title="All Company Users"
      description="Manage distributor and customer users across every partner company — invite, resend, reset, deactivate or remove."
      users={externalUsers}
      // Role options are recomputed per-picked-company inside UsersPanel when
      // companies is passed, so we leave the default empty here.
      roleChoices={[]}
      canManage={can(user, 'manage_company_users_global')}
      refresh={refresh}
      companies={externalCompanies}
      addLabel="Invite user"
      emptyHint="No external users yet. Invite a company from Partners, or add a user here for an existing company."
    />
  )
}
