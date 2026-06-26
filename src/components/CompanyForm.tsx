import { useMemo, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Modal } from './Modal'
import { DataTable, type Column } from './DataTable'
import { Badge } from './Badge'
import { Field, useToast } from './ui'
import { createResource, updateResource, deleteResource, createUserApi } from '../lib/api'
import { primaryAdminRoleForType, roleLabel } from '../lib/permissions'
import { COMPANY_TYPE_LABEL, ORG_STATUS_TONE, ORG_STATUS_LABEL, ONBOARDING_STATUS_LABEL, INDUSTRY_OPTIONS, COUNTRY_OPTIONS } from '../lib/constants'
import { companyOptions, generateCompanyCode } from '../lib/options'
import type { Company, CompanyType } from '../lib/types'

/**
 * Internal "Companies & partners" admin surface. Unlike the generic CrudResource,
 * the company form is a bespoke, sectioned flow because creating a company is an
 * *invitation*: it provisions the company record AND invites its primary admin in
 * one step (client feedback 2026-06, "Invite Company").
 *
 *  - New ("Invite Company"): Company Information + Admin Invitation only. The admin
 *    name/email are required; on submit we create the company, then invite the admin
 *    (default role derived from the company type). Commercial/integration fields are
 *    deliberately absent from the invite — they're filled later when editing.
 *  - Edit ("Edit Company"): the full record, with the commercial/integration fields
 *    in two collapsed "Optional …" sections so the basic profile stays uncluttered.
 *
 * Company code is auto-generated (never hand-entered); status is left to its server
 * default on create.
 */

type FormState = {
  companyName: string
  companyType: CompanyType
  parentCompanyId: string
  country: string
  website: string
  industry: string
  // Admin invitation (create-only)
  adminName: string
  adminEmail: string
  // Optional commercial setup
  serviceTier: string
  subscriptionType: string
  billingContactName: string
  billingContactEmail: string
  contractStart: string
  renewalDate: string
  // Optional integration setup
  zendeskOrgId: string
}

const EMPTY: FormState = {
  companyName: '',
  companyType: 'customer',
  parentCompanyId: '',
  country: '',
  website: '',
  industry: '',
  adminName: '',
  adminEmail: '',
  serviceTier: '',
  subscriptionType: '',
  billingContactName: '',
  billingContactEmail: '',
  contractStart: '',
  renewalDate: '',
  zendeskOrgId: '',
}

function fromCompany(c: Company): FormState {
  return {
    companyName: c.companyName ?? '',
    companyType: c.companyType,
    parentCompanyId: c.parentCompanyId ?? '',
    country: c.country ?? '',
    website: c.website ?? '',
    industry: c.industry ?? '',
    adminName: '',
    adminEmail: '',
    serviceTier: c.serviceTier ?? '',
    subscriptionType: c.subscriptionType ?? '',
    billingContactName: c.billingContactName ?? '',
    billingContactEmail: c.billingContactEmail ?? '',
    contractStart: c.contractStart ?? '',
    renewalDate: c.renewalDate ?? '',
    zendeskOrgId: c.zendeskOrgId ?? '',
  }
}

// Shared typography for a section heading — used by both the static <SectionTitle>
// and the collapsible <summary> headings so they stay visually identical.
const SECTION_HEADING_CLASS = 'text-[13px] font-semibold tracking-tight text-ink dark:text-ink-dark'

/** Section heading inside the modal. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={`${SECTION_HEADING_CLASS} sm:col-span-2`}>{children}</h3>
}

export function CompanyForm({
  companies,
  canManage,
  refresh,
}: {
  companies: Company[]
  canManage: boolean
  refresh: () => Promise<void>
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<Company | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((s) => ({ ...s, [key]: value }))

  const open = (row: Company | null) => {
    if (!canManage) return
    setEditing(row)
    setCreating(!row)
    setForm(row ? fromCompany(row) : EMPTY)
  }
  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  // Parent is only meaningful for a customer sitting under a distributor.
  const isCustomer = form.companyType === 'customer'
  const distributorOptions = useMemo(
    () => companyOptions(companies.filter((c) => c.companyType === 'distributor')),
    [companies],
  )
  const adminRole = primaryAdminRoleForType(form.companyType)

  const validate = (): string | null => {
    if (!form.companyName.trim()) return 'Company name is required.'
    if (!form.companyType) return 'Type is required.'
    if (!form.country.trim()) return 'Country / region is required.'
    if (isCustomer && !form.parentCompanyId) return 'Parent Distributor is required when inviting a Customer under a Distributor.'
    if (creating) {
      if (!form.adminName.trim()) return 'Primary admin name is required.'
      if (!form.adminEmail.trim()) return 'Primary admin email is required.'
    }
    return null
  }

  const companyPayload = (): Partial<Company> => ({
    companyName: form.companyName.trim(),
    companyType: form.companyType,
    parentCompanyId: isCustomer ? form.parentCompanyId || null : null,
    country: form.country.trim() || null,
    website: form.website.trim() || null,
    industry: form.industry || null,
    // Commercial + integration: only sent when editing (absent from the invite form).
    ...(creating
      ? {}
      : {
          serviceTier: form.serviceTier.trim() || null,
          subscriptionType: form.subscriptionType.trim() || null,
          billingContactName: form.billingContactName.trim() || null,
          billingContactEmail: form.billingContactEmail.trim() || null,
          contractStart: form.contractStart || null,
          renewalDate: form.renewalDate || null,
          zendeskOrgId: form.zendeskOrgId.trim() || null,
        }),
  })

  const save = async () => {
    const err = validate()
    if (err) {
      toast.push(err, 'error')
      return
    }
    setBusy(true)
    try {
      if (creating) {
        // 1) Create the company (auto-generated code; status left to its server default).
        const { item } = await createResource<Company>('companies', {
          ...companyPayload(),
          companyCode: generateCompanyCode(form.companyName),
        })
        // 2) Invite the primary admin into the new company. A failed invite must not
        //    silently look like success — surface it so the operator can retry from
        //    User management (the company itself is already created).
        try {
          await createUserApi({
            fullName: form.adminName.trim(),
            email: form.adminEmail.trim(),
            role: adminRole,
            companyId: item.id,
          })
        } catch (e) {
          await refresh()
          toast.push(
            `Company created, but the admin invite failed: ${e instanceof Error ? e.message : 'unknown error'}. Invite them from User management.`,
            'error',
          )
          close()
          return
        }
        await refresh()
        toast.push(`Company created and invite sent to ${form.adminEmail.trim()}.`)
      } else if (editing) {
        await updateResource<Company>('companies', editing.id, companyPayload())
        await refresh()
        toast.push('Saved.')
      }
      close()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Save failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    if (!confirm('Delete this company?')) return
    setBusy(true)
    try {
      await deleteResource('companies', editing.id)
      await refresh()
      toast.push('Deleted.')
      close()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<Company>[] = [
    { key: 'companyName', header: 'Company', render: (c) => <span className="font-medium">{c.companyName}</span> },
    {
      key: 'companyType',
      header: 'Type',
      sortAccessor: (c) => COMPANY_TYPE_LABEL[c.companyType] ?? c.companyType,
      render: (c) => <Badge tone="neutral">{COMPANY_TYPE_LABEL[c.companyType]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortAccessor: (c) => ORG_STATUS_LABEL[c.status] ?? c.status,
      render: (c) => <Badge tone={ORG_STATUS_TONE[c.status]}>{ORG_STATUS_LABEL[c.status] ?? c.status}</Badge>,
    },
    {
      key: 'onboardingStatus',
      header: 'Onboarding',
      sortAccessor: (c) => ONBOARDING_STATUS_LABEL[c.onboardingStatus] ?? c.onboardingStatus,
      render: (c) => <Badge tone="info">{ONBOARDING_STATUS_LABEL[c.onboardingStatus]}</Badge>,
    },
    { key: 'industry', header: 'Industry', render: (c) => <span className="text-muted dark:text-muted-dark">{c.industry ?? '—'}</span> },
    { key: 'country', header: 'Country', render: (c) => <span className="text-muted dark:text-muted-dark">{c.country ?? '—'}</span> },
    ...(canManage
      ? [{ key: '_edit', header: '', className: 'w-10 text-right', render: () => <Pencil size={13} className="text-faint inline" /> } as Column<Company>]
      : []),
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">Companies</h2>
        {canManage && (
          <button className="btn-accent" onClick={() => open(null)}>
            <Plus size={14} /> Invite Company
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={companies} onRowClick={canManage ? open : undefined} defaultSort={{ key: 'updatedAt', dir: 'desc' }} />

      <Modal
        open={creating || !!editing}
        onClose={close}
        wide
        title={creating ? 'Invite Company' : 'Edit Company'}
        footer={
          <>
            {editing && !creating && (
              <button className="btn-danger mr-auto" onClick={remove} disabled={busy}>
                Delete
              </button>
            )}
            <button className="btn-ghost" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button className="btn-accent" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : creating ? 'Create & send invite' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ── Company Information ───────────────────────────────── */}
          <SectionTitle>Company Information</SectionTitle>
          <Field label="Company name">
            <input className="input" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Acme Semiconductor" />
          </Field>
          <Field label="Type">
            <select className="select" value={form.companyType} onChange={(e) => set('companyType', e.target.value as CompanyType)}>
              <option value="sigenic">Sigenic (internal)</option>
              <option value="distributor">Distributor</option>
              <option value="customer">Customer</option>
            </select>
          </Field>
          {isCustomer && (
            <Field label="Parent Distributor" hint="Required when inviting a Customer under a Distributor">
              <select className="select" value={form.parentCompanyId} onChange={(e) => set('parentCompanyId', e.target.value)}>
                <option value="">—</option>
                {distributorOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Country / Region">
            <select className="select" value={form.country} onChange={(e) => set('country', e.target.value)}>
              <option value="">—</option>
              {/* If a previously-saved row has a free-text country we no longer list
                  (older data, typo, since-renamed country), surface it as a one-off
                  option so the value isn't silently dropped when the row is edited. */}
              {form.country && !(COUNTRY_OPTIONS as readonly string[]).includes(form.country) && (
                <option value={form.country}>{form.country}</option>
              )}
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Industry" hint="Optional">
            <select className="select" value={form.industry} onChange={(e) => set('industry', e.target.value)}>
              <option value="">—</option>
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company Website / Domain" hint="Optional">
            <input className="input" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="acme.com" />
          </Field>

          {/* ── Admin Invitation (create only) ────────────────────── */}
          {creating && (
            <>
              <SectionTitle>Admin Invitation</SectionTitle>
              <Field label="Primary Admin Name">
                <input className="input" value={form.adminName} onChange={(e) => set('adminName', e.target.value)} placeholder="Jane Tan" />
              </Field>
              <Field label="Primary Admin Email">
                <input type="email" className="input" value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="jane@acme.com" />
              </Field>
              <Field label="Primary Admin Role" hint="Set automatically from the company type">
                <input className="input bg-raised dark:bg-raised-dark" value={roleLabel(adminRole)} readOnly disabled />
              </Field>
            </>
          )}

          {/* ── Optional Commercial / Integration (edit only) ─────── */}
          {editing && !creating && (
            <>
              <details className="sm:col-span-2 group">
                <summary className={`cursor-pointer select-none ${SECTION_HEADING_CLASS}`}>
                  Optional Commercial Setup
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <Field label="Service tier">
                    <input className="input" value={form.serviceTier} onChange={(e) => set('serviceTier', e.target.value)} />
                  </Field>
                  <Field label="Subscription type">
                    <input className="input" value={form.subscriptionType} onChange={(e) => set('subscriptionType', e.target.value)} />
                  </Field>
                  <Field label="Billing contact name">
                    <input className="input" value={form.billingContactName} onChange={(e) => set('billingContactName', e.target.value)} />
                  </Field>
                  <Field label="Billing contact email">
                    <input type="email" className="input" value={form.billingContactEmail} onChange={(e) => set('billingContactEmail', e.target.value)} />
                  </Field>
                  <Field label="Contract start">
                    <input type="date" className="input" value={form.contractStart} onChange={(e) => set('contractStart', e.target.value)} />
                  </Field>
                  <Field label="Renewal date">
                    <input type="date" className="input" value={form.renewalDate} onChange={(e) => set('renewalDate', e.target.value)} />
                  </Field>
                </div>
              </details>

              <details className="sm:col-span-2 group">
                <summary className={`cursor-pointer select-none ${SECTION_HEADING_CLASS}`}>
                  Optional Integration Setup
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <Field label="Zendesk org ID">
                    <input className="input" value={form.zendeskOrgId} onChange={(e) => set('zendeskOrgId', e.target.value)} />
                  </Field>
                </div>
              </details>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
