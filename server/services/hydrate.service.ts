import { isInternal, audienceMatches, can } from '../../shared/permissions'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { HydrateBundle } from '../../shared/types'

/**
 * Role-scoped data bundle for the authenticated client. The 18 reads fire
 * concurrently; the permission/audience filtering lives here (service layer),
 * keeping the repository free of authorization logic.
 */
export async function hydrate(store: Store, auth: AuthPayload): Promise<HydrateBundle> {
  const me = await store.getUserById(auth.sub)
  const internal = isInternal(me)
  const companyId = me?.companyId ?? null
  const scoped = { where: 'company_id = $1', params: [companyId] }

  const [
    company,
    companiesAll,
    sites,
    users,
    departments,
    processes,
    machines,
    scoringModels,
    scoringRules,
    financialAssumptions,
    calculatorRuns,
    serviceRequests,
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
    internal ? store.list('scoring_rules', { order: 'created_at ASC' }) : Promise.resolve([]),
    internal ? store.list('financial_assumptions', {}) : Promise.resolve([]),
    internal ? store.list('calculator_runs', { order: 'created_at DESC' }) : store.list('calculator_runs', { ...scoped, order: 'created_at DESC' }),
    internal ? store.list('service_requests', { order: 'updated_at DESC' }) : store.list('service_requests', { ...scoped, order: 'updated_at DESC' }),
    store.list('knowledge_articles', { order: 'updated_at DESC' }),
    store.list('success_stories', { order: 'published_at DESC NULLS LAST' }),
    store.list('announcements', { order: 'pinned DESC, publish_at DESC' }),
    internal ? store.list('invoices', { order: 'issued_at DESC' }) : store.list('invoices', { ...scoped, order: 'issued_at DESC' }),
    store.list('notifications', { where: 'user_id = $1', params: [me?.id], order: 'created_at DESC' }),
    can(me, 'view_audit_logs') ? store.list('audit_logs', { order: 'created_at DESC' }) : Promise.resolve([]),
  ])

  const companies = internal ? companiesAll ?? [] : company ? [company] : []
  const activeModel = (internal ? scoringModels.find((m: any) => m.status === 'active') : scoringModels[0]) ?? null
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
    users,
    departments,
    processes,
    machines,
    scoringModels,
    scoringRules,
    financialAssumptions,
    activeScoringModelId: activeModel?.id ?? null,
    calculatorRuns,
    serviceRequests,
    knowledgeArticles,
    successStories,
    announcements,
    invoices,
    notifications,
    auditLogs,
  }
}
