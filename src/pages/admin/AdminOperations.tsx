import { useMemo, useState } from 'react'
import {
  Activity,
  BookOpenCheck,
  ClipboardCheck,
  Factory,
  GitBranch,
  History,
  KeyRound,
  LifeBuoy,
  Route,
  ShieldCheck,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../lib/auth'
import { load, save, uid } from '../../lib/storage'
import { seedCalc, seedDocs, seedInvoices, seedOps, seedTickets, seedUsers } from '../../lib/seed'
import type {
  CalcConfig,
  Doc,
  Invoice,
  KnowledgeGovernance,
  OpsConfig,
  PartnerCompany,
  PartnerStatus,
  PartnerTier,
  PermissionKey,
  RequestWorkflow,
  Ticket,
  TicketCategory,
  User,
} from '../../lib/types'
import { Badge } from '../../components/Badge'
import { fmtDate, fmtNumber, fmtRelative, fmtUSD } from '../../lib/format'

const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'calculator', label: 'Calc' },
  { key: 'case_studies', label: 'Stories' },
  { key: 'service_requests', label: 'Services' },
  { key: 'billing', label: 'Billing' },
  { key: 'zendesk', label: 'Zendesk' },
]

const SERVICE_CATEGORIES: TicketCategory[] = ['demo', 'onboarding', 'data', 'consulting']
const REVIEW_STATUSES: KnowledgeGovernance['status'][] = ['draft', 'approved', 'review_needed']
const ROUTES: RequestWorkflow['route'][] = ['zendesk', 'sales', 'ops']

export default function AdminOperations() {
  const { user } = useAuth()
  const [ops, setOps] = useState<OpsConfig>(() => load<OpsConfig>('ops', seedOps))
  const [tickets] = useState<Ticket[]>(() => load<Ticket[]>('tickets', seedTickets))
  const [docs] = useState<Doc[]>(() => load<Doc[]>('docs', seedDocs))
  const [users] = useState<User[]>(() => load<User[]>('users', seedUsers))
  const [invoices] = useState<Invoice[]>(() => load<Invoice[]>('invoices', seedInvoices))
  const [calc] = useState<CalcConfig>(() => load<CalcConfig>('calc', seedCalc))

  const persist = (next: OpsConfig) => {
    save('ops', next)
    setOps(next)
  }

  const withAudit = (next: OpsConfig, action: string, target: string, details: string): OpsConfig => ({
    ...next,
    audit: [
      {
        id: uid('audit'),
        actor: user?.name ?? 'Admin',
        action,
        target,
        details,
        createdAt: new Date().toISOString(),
      },
      ...next.audit,
    ].slice(0, 80),
  })

  const commit = (next: OpsConfig, action: string, target: string, details: string) =>
    persist(withAudit(next, action, target, details))

  const updatePartner = (
    id: string,
    fn: (partner: PartnerCompany) => PartnerCompany,
    action: string,
    details: string,
  ) => {
    const current = ops.partners.find((partner) => partner.id === id)
    if (!current) return
    const next = {
      ...ops,
      partners: ops.partners.map((partner) => (partner.id === id ? fn(partner) : partner)),
    }
    commit(next, action, current.name, details)
  }

  const updateWorkflow = (
    id: TicketCategory,
    fn: (workflow: RequestWorkflow) => RequestWorkflow,
    action: string,
    details: string,
  ) => {
    const current = ops.workflows.find((workflow) => workflow.id === id)
    if (!current) return
    const next = {
      ...ops,
      workflows: ops.workflows.map((workflow) => (workflow.id === id ? fn(workflow) : workflow)),
    }
    commit(next, action, current.label, details)
  }

  const updateKnowledge = (
    docId: string,
    fn: (entry: KnowledgeGovernance) => KnowledgeGovernance,
    action: string,
    details: string,
  ) => {
    const doc = docs.find((item) => item.id === docId)
    const next = {
      ...ops,
      knowledge: ops.knowledge.map((entry) => (entry.docId === docId ? fn(entry) : entry)),
    }
    commit(next, action, doc?.title ?? docId, details)
  }

  const metrics = useMemo(() => {
    const serviceTickets = tickets.filter((ticket) => SERVICE_CATEGORIES.includes(ticket.category))
    const escalations = tickets.filter((ticket) => {
      const ageDays = (Date.now() - +new Date(ticket.createdAt)) / 86400000
      return (
        ticket.status !== 'resolved' &&
        ticket.status !== 'closed' &&
        (ticket.priority === 'urgent' || ticket.priority === 'high' || ageDays >= 7)
      )
    })
    const reviewDue = ops.knowledge.filter((entry) => {
      const due = +new Date(entry.reviewDue)
      return entry.status === 'review_needed' || due < Date.now() + 14 * 86400000
    })
    return {
      activePartners: ops.partners.filter((partner) => partner.status === 'active').length,
      onboardingPartners: ops.partners.filter((partner) => partner.status === 'onboarding').length,
      partnerSites: ops.partners.reduce((sum, partner) => sum + partner.sites.length, 0),
      serviceTickets,
      escalations,
      reviewDue,
    }
  }, [ops, tickets])

  const partnerTicketCounts = useMemo(() => {
    const byCompany = new Map(users.map((item) => [item.name, item.company]))
    const counts: Record<string, number> = {}
    for (const ticket of tickets) {
      const company = byCompany.get(ticket.requester) ?? ticket.requester
      counts[company] = (counts[company] ?? 0) + 1
    }
    return counts
  }, [tickets, users])

  const decisionRows = useMemo(() => {
    return ops.partners
      .map((partner) => {
        const support = partnerTicketCounts[partner.name] ?? 0
        const incomplete = partner.onboarding.filter((item) => !item.done).length
        const commercial =
          partner.trial || partner.status === 'onboarding' ? 8 : partner.tier === 'strategic' ? 10 : 5
        const permissions = Object.values(partner.permissions).filter(Boolean).length
        return {
          partner,
          score: support * 7 + incomplete * 4 + commercial + permissions,
          reason:
            incomplete > 0
              ? `${incomplete} onboarding steps open`
              : support > 0
                ? `${support} support touchpoints`
                : 'Low-friction expansion candidate',
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [ops.partners, partnerTicketCounts])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight">Operations command layer</h2>
        <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">
          Partner permissions, request routing, ticket oversight, knowledge governance, billing metadata, onboarding, audit history, and decision signals.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Active partners" value={fmtNumber(metrics.activePartners)} sub={`${metrics.onboardingPartners} onboarding`} icon={ShieldCheck} />
        <Kpi label="Mapped sites" value={fmtNumber(metrics.partnerSites)} sub="partner fabs" icon={Factory} />
        <Kpi label="Open escalations" value={fmtNumber(metrics.escalations.length)} sub="priority or aging" icon={LifeBuoy} />
        <Kpi label="Review queue" value={fmtNumber(metrics.reviewDue.length)} sub="knowledge governance" icon={BookOpenCheck} />
      </section>

      <PartnerAccessTable ops={ops} updatePartner={updatePartner} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <WorkflowPanel workflows={ops.workflows} updateWorkflow={updateWorkflow} />
        <TicketOversight tickets={tickets} serviceTickets={metrics.serviceTickets} escalations={metrics.escalations} />
      </section>

      <KnowledgeGovernancePanel docs={docs} governance={ops.knowledge} updateKnowledge={updateKnowledge} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CommercialOnboarding partners={ops.partners} invoices={invoices} updatePartner={updatePartner} />
        <MasterDataPanel calc={calc} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DecisionLayer rows={decisionRows} />
        <AuditTrail audit={ops.audit} />
      </section>
    </div>
  )
}

function PartnerAccessTable({
  ops,
  updatePartner,
}: {
  ops: OpsConfig
  updatePartner: (
    id: string,
    fn: (partner: PartnerCompany) => PartnerCompany,
    action: string,
    details: string,
  ) => void
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <KeyRound size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Partner account & permission control</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Controls calculator, stories, service intake, billing, and Zendesk access per account.
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[1060px]">
          <thead>
            <tr>
              <th>Partner</th>
              <th className="w-32">Status</th>
              <th className="w-32">Tier</th>
              <th>Sites / fabs</th>
              <th className="w-[300px]">Permissions</th>
              <th className="w-28">Renewal</th>
            </tr>
          </thead>
          <tbody>
            {ops.partners.map((partner) => (
              <tr key={partner.id}>
                <td>
                  <div className="text-[13.5px] font-medium">{partner.name}</div>
                  <div className="mt-0.5 text-[11px] text-muted dark:text-muted-dark">
                    {partner.primaryContact} · {partner.serviceTier}
                  </div>
                </td>
                <td>
                  <select
                    className="select h-8 text-[12px]"
                    value={partner.status}
                    onChange={(event) =>
                      updatePartner(
                        partner.id,
                        (item) => ({ ...item, status: event.target.value as PartnerStatus }),
                        'Changed partner status',
                        `Status set to ${event.target.value}.`,
                      )
                    }
                  >
                    {(['active', 'onboarding', 'inactive'] as PartnerStatus[]).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="select h-8 text-[12px]"
                    value={partner.tier}
                    onChange={(event) =>
                      updatePartner(
                        partner.id,
                        (item) => ({ ...item, tier: event.target.value as PartnerTier }),
                        'Changed partner tier',
                        `Tier set to ${event.target.value}.`,
                      )
                    }
                  >
                    {(['trial', 'standard', 'plus', 'strategic'] as PartnerTier[]).map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="space-y-1">
                    {partner.sites.map((site) => (
                      <div key={site.id} className="text-[12px] text-muted dark:text-muted-dark">
                        <span className="text-ink dark:text-ink-dark">{site.name}</span> · {site.region} ·{' '}
                        <span className="font-mono">{site.fabs.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {PERMISSIONS.map((permission) => (
                      <label
                        key={permission.key}
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px]',
                          partner.permissions[permission.key]
                            ? 'border-accent bg-accent/10 text-ink dark:text-ink-dark'
                            : 'border-line dark:border-line-dark text-muted dark:text-muted-dark',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={partner.permissions[permission.key]}
                          onChange={(event) =>
                            updatePartner(
                              partner.id,
                              (item) => ({
                                ...item,
                                permissions: { ...item.permissions, [permission.key]: event.target.checked },
                              }),
                              'Changed access permission',
                              `${permission.label} ${event.target.checked ? 'enabled' : 'disabled'}.`,
                            )
                          }
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="font-mono text-[11.5px] text-muted dark:text-muted-dark">
                  {fmtDate(partner.renewalDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function WorkflowPanel({
  workflows,
  updateWorkflow,
}: {
  workflows: RequestWorkflow[]
  updateWorkflow: (
    id: TicketCategory,
    fn: (workflow: RequestWorkflow) => RequestWorkflow,
    action: string,
    details: string,
  ) => void
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <Route size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Form / workflow configuration</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Enable request types and choose whether each goes to Zendesk, sales, or ops.
          </div>
        </div>
      </div>
      <div className="divide-hair">
        {workflows.map((workflow) => (
          <div key={workflow.id} className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <label className="md:col-span-4 flex items-start gap-2">
              <input
                type="checkbox"
                checked={workflow.enabled}
                onChange={(event) =>
                  updateWorkflow(
                    workflow.id,
                    (item) => ({ ...item, enabled: event.target.checked }),
                    'Changed workflow availability',
                    `${workflow.label} ${event.target.checked ? 'enabled' : 'disabled'}.`,
                  )
                }
                className="mt-1"
              />
              <span>
                <span className="block text-[13px] font-medium">{workflow.label}</span>
                <span className="block text-[11px] text-muted dark:text-muted-dark mt-0.5">
                  {workflow.requiredFields.length} required fields
                </span>
              </span>
            </label>
            <div className="md:col-span-3">
              <label className="label">Route</label>
              <select
                value={workflow.route}
                className="select h-8 text-[12px]"
                onChange={(event) =>
                  updateWorkflow(
                    workflow.id,
                    (item) => ({ ...item, route: event.target.value as RequestWorkflow['route'] }),
                    'Changed workflow route',
                    `Route set to ${event.target.value}.`,
                  )
                }
              >
                {ROUTES.map((route) => (
                  <option key={route} value={route}>{route}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5">
              <label className="label">Owner / tags</label>
              <div className="text-[12px] text-muted dark:text-muted-dark">
                <span className="text-ink dark:text-ink-dark">{workflow.ownerRole}</span> ·{' '}
                <span className="font-mono">{workflow.zendeskTags.join(', ')}</span>
              </div>
              <div className="mt-1 text-[11px] text-faint dark:text-faint-dark line-clamp-1">
                {workflow.requiredFields.join(' · ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TicketOversight({
  tickets,
  serviceTickets,
  escalations,
}: {
  tickets: Ticket[]
  serviceTickets: Ticket[]
  escalations: Ticket[]
}) {
  const recentServices = [...serviceTickets]
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 5)
  const openTickets = tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress')

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <LifeBuoy size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Request intake & ticket escalation</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Management view over service requests and Zendesk-backed support volume.
          </div>
        </div>
        <span className="ml-auto text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
          {openTickets.length} open
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line dark:divide-line-dark">
        <div className="p-4">
          <h4 className="text-[12.5px] font-medium mb-2">Latest service requests</h4>
          <ul className="space-y-2.5">
            {recentServices.map((ticket) => (
              <li key={ticket.id} className="text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{ticket.subject}</span>
                  <Badge tone={ticket.status} dot />
                </div>
                <div className="mt-0.5 text-[11px] text-muted dark:text-muted-dark">
                  <span className="font-mono">{ticket.id}</span> · {ticket.category} · {ticket.requester}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4">
          <h4 className="text-[12.5px] font-medium mb-2">Escalation queue</h4>
          <ul className="space-y-2.5">
            {escalations.slice(0, 5).map((ticket) => (
              <li key={ticket.id} className="text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{ticket.subject}</span>
                  <Badge tone={ticket.priority}>{ticket.priority}</Badge>
                </div>
                <div className="mt-0.5 text-[11px] text-muted dark:text-muted-dark">
                  {ticket.productArea ?? 'Other'} · opened {fmtRelative(ticket.createdAt)}
                </div>
              </li>
            ))}
            {escalations.length === 0 && (
              <li className="text-[12px] text-muted dark:text-muted-dark">No tickets currently require escalation.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

function KnowledgeGovernancePanel({
  docs,
  governance,
  updateKnowledge,
}: {
  docs: Doc[]
  governance: KnowledgeGovernance[]
  updateKnowledge: (
    docId: string,
    fn: (entry: KnowledgeGovernance) => KnowledgeGovernance,
    action: string,
    details: string,
  ) => void
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <BookOpenCheck size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Knowledge base governance</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Curate articles, tags, partner visibility, and stale-content reviews even when content lives in Notion or Zendesk Guide.
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl min-w-[900px]">
          <thead>
            <tr>
              <th>Article</th>
              <th className="w-36">Owner</th>
              <th className="w-36">Status</th>
              <th className="w-32">Review due</th>
              <th>Visible to</th>
              <th className="w-24">Featured</th>
            </tr>
          </thead>
          <tbody>
            {governance.map((entry) => {
              const doc = docs.find((item) => item.id === entry.docId)
              return (
                <tr key={entry.docId}>
                  <td>
                    <div className="text-[13px] font-medium">{doc?.title ?? entry.docId}</div>
                    <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
                      {doc?.category ?? 'Article'} · {entry.tags.join(', ')}
                    </div>
                  </td>
                  <td className="text-[12px]">{entry.owner}</td>
                  <td>
                    <select
                      className="select h-8 text-[12px]"
                      value={entry.status}
                      onChange={(event) =>
                        updateKnowledge(
                          entry.docId,
                          (item) => ({ ...item, status: event.target.value as KnowledgeGovernance['status'] }),
                          'Changed article governance',
                          `Status set to ${event.target.value}.`,
                        )
                      }
                    >
                      {REVIEW_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td className="font-mono text-[11.5px] text-muted dark:text-muted-dark">{fmtDate(entry.reviewDue)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {entry.visibleTo.map((segment) => (
                        <span key={segment} className="px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark text-[10.5px] font-mono text-muted dark:text-muted-dark">
                          {segment}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <label className="inline-flex items-center gap-1.5 text-[12px]">
                      <input
                        type="checkbox"
                        checked={entry.featured}
                        onChange={(event) =>
                          updateKnowledge(
                            entry.docId,
                            (item) => ({ ...item, featured: event.target.checked }),
                            'Changed article feature flag',
                            event.target.checked ? 'Marked as featured.' : 'Removed from featured articles.',
                          )
                        }
                      />
                      featured
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CommercialOnboarding({
  partners,
  invoices,
  updatePartner,
}: {
  partners: PartnerCompany[]
  invoices: Invoice[]
  updatePartner: (
    id: string,
    fn: (partner: PartnerCompany) => PartnerCompany,
    action: string,
    details: string,
  ) => void
}) {
  const openInvoice = invoices.find((invoice) => invoice.status === 'open')

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <ClipboardCheck size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Commercial visibility & onboarding</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Contracts, billing contacts, service tiers, and repeatable onboarding motion.
          </div>
        </div>
      </div>
      <div className="divide-hair">
        {partners.slice(0, 4).map((partner) => (
          <div key={partner.id} className="p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-[13.5px] font-medium">{partner.name}</h4>
                  <StatusPill status={partner.status} />
                </div>
                <div className="mt-1 text-[11.5px] text-muted dark:text-muted-dark">
                  {partner.subscriptionType} · {partner.serviceTier} · renewal {fmtDate(partner.renewalDate)}
                </div>
                <div className="mt-1 text-[11.5px] text-muted dark:text-muted-dark">
                  Billing: {partner.billingContact} · demo invoice baseline {openInvoice ? fmtUSD(openInvoice.amount) : 'n/a'}
                </div>
              </div>
              <div className="text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                {partner.trial ? 'trial' : partner.tier}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {partner.onboarding.map((milestone) => (
                <label key={milestone.key} className="flex items-center gap-2 text-[12px] rounded-md border border-line dark:border-line-dark px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={milestone.done}
                    onChange={(event) =>
                      updatePartner(
                        partner.id,
                        (item) => ({
                          ...item,
                          onboarding: item.onboarding.map((entry) =>
                            entry.key === milestone.key
                              ? {
                                  ...entry,
                                  done: event.target.checked,
                                  completedAt: event.target.checked ? new Date().toISOString() : undefined,
                                }
                              : entry,
                          ),
                        }),
                        'Changed onboarding milestone',
                        `${milestone.label} marked ${event.target.checked ? 'done' : 'open'}.`,
                      )
                    }
                  />
                  <span className={milestone.done ? 'text-ink dark:text-ink-dark' : 'text-muted dark:text-muted-dark'}>
                    {milestone.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MasterDataPanel({ calc }: { calc: CalcConfig }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <Factory size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Machine / process master data</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Department and machine mapping used by the Score Calculator.
          </div>
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {calc.departments.map((department) => {
          const machines = calc.machines.filter((machine) => department.machineIds.includes(machine.id))
          const processCount = calc.processes.filter((process) =>
            process.compatibleMachines.some((id) => department.machineIds.includes(id)),
          ).length
          return (
            <div key={department.id} className="rounded-md border border-line dark:border-line-dark p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-medium">{department.name}</div>
                <span className="text-[10.5px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
                  {processCount} processes
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {machines.map((machine) => (
                  <span key={machine.id} className="px-1.5 py-0.5 rounded bg-raised dark:bg-raised-dark text-[11px] text-muted dark:text-muted-dark">
                    {machine.name}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DecisionLayer({
  rows,
}: {
  rows: { partner: PartnerCompany; score: number; reason: string }[]
}) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <GitBranch size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Internal decision layer</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Simple prioritization for upsell, adoption, and support focus.
          </div>
        </div>
      </div>
      <ul className="divide-hair">
        {rows.map(({ partner, score, reason }) => (
          <li key={partner.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">{partner.name}</div>
              <div className="text-[11.5px] text-muted dark:text-muted-dark mt-0.5">{reason}</div>
            </div>
            <div className="text-right">
              <div className="text-[20px] font-semibold tracking-tightest num leading-none">{score}</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark mt-1">priority</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AuditTrail({ audit }: { audit: OpsConfig['audit'] }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center gap-2">
        <History size={14} className="text-muted dark:text-muted-dark" />
        <div>
          <h3 className="text-[13px] font-medium">Audit trail / change history</h3>
          <div className="text-[11px] text-muted dark:text-muted-dark mt-0.5">
            Tracks who changed rules, permissions, publishing, and onboarding state.
          </div>
        </div>
      </div>
      <ul className="divide-hair max-h-[420px] overflow-y-auto">
        {audit.map((event) => (
          <li key={event.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[12.5px] font-medium">{event.action}</div>
              <div className="text-[10.5px] font-mono text-faint dark:text-faint-dark">{fmtRelative(event.createdAt)}</div>
            </div>
            <div className="mt-0.5 text-[12px] text-muted dark:text-muted-dark">
              {event.target} · {event.details}
            </div>
            <div className="mt-1 text-[10.5px] font-mono uppercase tracking-[0.1em] text-faint dark:text-faint-dark">
              {event.actor}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof Activity }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="stat-label">{label}</div>
        <Icon size={14} className="text-faint dark:text-faint-dark" />
      </div>
      <div className="mt-2 text-[26px] font-semibold tracking-tightest num leading-none">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-muted dark:text-muted-dark">{sub}</div>}
    </div>
  )
}

function StatusPill({ status }: { status: PartnerStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em]',
        status === 'active' && 'border-success/30 text-success bg-success/5',
        status === 'onboarding' && 'border-warn/30 text-warn bg-warn/5',
        status === 'inactive' && 'border-line dark:border-line-dark text-muted dark:text-muted-dark bg-raised dark:bg-raised-dark',
      )}
    >
      {status}
    </span>
  )
}
