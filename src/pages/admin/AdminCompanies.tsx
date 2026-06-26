import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { PageHeader } from '../../components/PageHeader'
import { CompanyForm } from '../../components/CompanyForm'

export default function AdminCompanies() {
  const { user } = useAuth()
  const { companies, refresh } = useData()
  const canManage = can(user, 'manage_companies')

  return (
    <div>
      <PageHeader
        eyebrow="Partners"
        title="Companies"
        description="Distributors, customers, and internal orgs. Invite a company to provision its record and its primary admin in one step; manage commercial and integration details by editing it. Internal management only."
      />

      <CompanyForm companies={companies} canManage={canManage} refresh={refresh} />
    </div>
  )
}
