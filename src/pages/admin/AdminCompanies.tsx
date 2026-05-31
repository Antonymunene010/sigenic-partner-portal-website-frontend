import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { COMPANY_TYPE_LABEL, ONBOARDING_STATUS_LABEL, ORG_STATUS_TONE } from '../../lib/constants'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { companyOptions } from '../../lib/options'
import type { Company } from '../../lib/types'

export default function AdminCompanies() {
  const { user } = useAuth()
  const { companies, refresh } = useData()
  const canManage = can(user, 'manage_companies')

  const parentOptions = companyOptions(companies)

  return (
    <div>
      <PageHeader
        eyebrow="Partners"
        title="Companies & partners"
        description="Distributors, customers, and internal orgs. Manage relationships, onboarding, and billing contacts. Internal management only."
      />

      <CrudResource<Company>
        title="Companies"
        resource="companies"
        idPrefix="co"
        canManage={canManage}
        rows={companies}
        refresh={refresh}
        columns={[
          { key: 'companyName', header: 'Company', render: (c) => <span className="font-medium">{c.companyName}</span> },
          { key: 'companyType', header: 'Type', sortAccessor: (c) => COMPANY_TYPE_LABEL[c.companyType] ?? c.companyType, render: (c) => <Badge tone="neutral">{COMPANY_TYPE_LABEL[c.companyType]}</Badge> },
          { key: 'status', header: 'Status', render: (c) => <Badge tone={ORG_STATUS_TONE[c.status]}>{c.status}</Badge> },
          { key: 'onboardingStatus', header: 'Onboarding', sortAccessor: (c) => ONBOARDING_STATUS_LABEL[c.onboardingStatus] ?? c.onboardingStatus, render: (c) => <Badge tone="info">{ONBOARDING_STATUS_LABEL[c.onboardingStatus]}</Badge> },
          { key: 'industry', header: 'Industry', render: (c) => <span className="text-muted dark:text-muted-dark">{c.industry}</span> },
        ]}
        fields={[
          { key: 'companyName', label: 'Company name', required: true },
          { key: 'companyCode', label: 'Company code' },
          {
            key: 'companyType',
            label: 'Type',
            type: 'select',
            required: true,
            defaultValue: 'customer',
            options: [
              { value: 'sigenic', label: 'Sigenic (internal)' },
              { value: 'distributor', label: 'Distributor' },
              { value: 'customer', label: 'Customer' },
            ],
          },
          { key: 'parentCompanyId', label: 'Parent company', type: 'select', options: parentOptions, help: 'for distributor→customer' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            defaultValue: 'active',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'prospect', label: 'Prospect' },
            ],
          },
          { key: 'industry', label: 'Industry' },
          { key: 'zendeskOrgId', label: 'Zendesk org ID' },
          { key: 'billingContactName', label: 'Billing contact name' },
          { key: 'billingContactEmail', label: 'Billing contact email' },
          {
            key: 'onboardingStatus',
            label: 'Onboarding status',
            type: 'select',
            defaultValue: 'not_started',
            options: [
              { value: 'not_started', label: 'Not started' },
              { value: 'invited', label: 'Invited' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'fully_onboarded', label: 'Fully onboarded' },
            ],
          },
          { key: 'serviceTier', label: 'Service tier' },
          { key: 'subscriptionType', label: 'Subscription type' },
          { key: 'contractStart', label: 'Contract start', type: 'date' },
          { key: 'renewalDate', label: 'Renewal date', type: 'date' },
        ]}
      />
    </div>
  )
}
