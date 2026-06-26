import { isInternal, submissionVisibility, audienceMatches, can, canSeePendingSignup } from '../../shared/permissions'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { HydrateBundle } from '../../shared/types'

/**
 * Role-scoped data bundle for the authenticated client. The reads fire
 * concurrently; the permission/audience filtering lives here (service layer),
 * keeping the repository free of authorization logic.
 */
export async function hydrate(store: Store, auth: AuthPayload): Promise<HydrateBundle> {
  const me = await store.getUserById(auth.sub)
  const internal = isInternal(me)
  const companyId = me?.companyId ?? null
  const scoped = { where: 'company_id = $1', params: [companyId] }
  // Submissions (requests, calculator runs): SQL projection of submissionVisibility —
  // internal staff see everything, company admins the whole company's, plain users their own.
  const submissionScope = {
    all: {},
    company: scoped,
    own: { where: 'user_id = $1', params: [auth.sub] },
  }[submissionVisibility(me)]

  const [
    company,
    companiesAll,
    sites,
    users,
    departments,
    processes,
    machines,
    scoringModels,
    allIssues,
    occurrenceOptions,
    detectionOptions,
    technologyPrices,
    calculatorRuns,
    serviceRequests,
    requestTypes,
    requestDepartments,
    requestProcesses,
    requestMachines,
    allArticles,
    allStories,
    allAnnouncements,
    invoices,
    notifications,
    auditLogs,
  ] = await Promise.all([
    companyId ? store.getOne('companies', companyId) : Promise.resolve(null),
    internal ? store.list('companies', { order: 'company_name ASC' }) : Promise.resolve(null),
    internal ? store.list('sites', { order: 'site_name ASC' }) : store.list('sites', scoped),
    internal ? store.list('users', { order: 'full_name ASC' }) : store.list('users', { ...scoped, order: 'full_name ASC' }),
    store.list('departments', { order: 'name ASC' }),
    store.list('processes', { order: 'process_name ASC' }),
    store.list('machines', { order: 'machine_name ASC' }),
    internal ? store.list('scoring_models', { order: 'created_at DESC' }) : store.getActiveScoringModel().then((m) => (m ? [m] : [])),
    store.list('calculator_issues', { order: 'sort_order ASC' }),
    store.list('occurrence_options', { order: 'sort_order ASC' }),
    store.list('detection_options', { order: 'sort_order ASC' }),
    store.list('technology_prices', { order: 'technology ASC' }),
    store.list('calculator_runs', { ...submissionScope, order: 'created_at DESC' }),
    store.list('service_requests', { ...submissionScope, order: 'updated_at DESC' }),
    store.list('request_types', { order: 'sort_order ASC' }),
    store.list('request_departments', { order: 'sort_order ASC' }),
    store.list('request_processes', { order: 'sort_order ASC' }),
    store.list('request_machines', { order: 'sort_order ASC' }),
    store.list('knowledge_articles', { order: 'updated_at DESC' }),
    store.list('success_stories', { order: 'published_at DESC NULLS LAST' }),
    store.list('announcements', { order: 'pinned DESC, publish_at DESC' }),
    internal ? store.list('invoices', { order: 'issued_at DESC' }) : store.list('invoices', { ...scoped, order: 'issued_at DESC' }),
    store.list('notifications', { where: 'user_id = $1', params: [me?.id], order: 'created_at DESC' }),
    can(me, 'view_audit_logs') ? store.list('audit_logs', { order: 'created_at DESC' }) : Promise.resolve([]),
  ])

  // Pending/rejected sign-ups are only visible to whoever can review them (internal
  // staff, or the user's own company admin) — they must not surface in a plain
  // member's team roster. Active/invited/inactive users pass through untouched.
  // Internal users see every user already; skip the per-row filter on that path.
  const visibleUsers = internal
    ? users
    : users.filter((u: any) =>
        (u.status !== 'pending' && u.status !== 'rejected') || canSeePendingSignup(me, u.companyId),
      )

  const companies = internal ? companiesAll ?? [] : company ? [company] : []
  const activeModel = (internal ? scoringModels.find((m: any) => m.status === 'active') : scoringModels[0]) ?? null
  // Non-internal users only see the active model's issue catalog.
  const calculatorIssues = internal ? allIssues : allIssues.filter((i: any) => i.scoringModelId === activeModel?.id)
  const knowledgeArticles = internal ? allArticles : allArticles.filter((a: any) => a.active && audienceMatches(me, a.audienceType))
  const successStories = internal ? allStories : allStories.filter((s: any) => s.status === 'published' && s.visibility !== 'internal')
  const now = Date.now()
  const announcements = internal
    ? allAnnouncements
    : allAnnouncements.filter(
        (a: any) =>
          a.active &&
          audienceMatches(me, a.audienceType) &&
          (!a.publishAt || new Date(a.publishAt).getTime() <= now) &&
          (!a.expireAt || new Date(a.expireAt).getTime() >= now) &&
          (!a.companyId || a.companyId === companyId),
      )

  return {
    me,
    company,
    companies,
    sites,
    users: visibleUsers,
    departments,
    processes,
    machines,
    scoringModels,
    calculatorIssues,
    occurrenceOptions,
    detectionOptions,
    technologyPrices,
    activeScoringModelId: activeModel?.id ?? null,
    calculatorRuns,
    serviceRequests,
    requestTypes,
    requestDepartments,
    requestProcesses,
    requestMachines,
    knowledgeArticles,
    successStories,
    announcements,
    invoices,
    notifications,
    auditLogs,
  }
}
