import { can } from '../../shared/permissions'
import { forbidden } from '../http/errors'
import { audit } from './audit'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

/** Activate a scoring model, archiving any other active model first (single active invariant). */
export async function activateScoringModel(store: Store, auth: AuthPayload, modelId: string): Promise<any> {
  if (!can(auth, 'manage_scoring')) throw forbidden()
  const active = await store.list('scoring_models', { where: "status = 'active'", params: [] })
  await Promise.all(
    active.filter((m: any) => m.id !== modelId).map((m: any) => store.update('scoring_models', m.id, { status: 'archived' }, { touch: false })),
  )
  const updated = await store.update('scoring_models', modelId, { status: 'active' }, { touch: false })
  await audit(store, auth, 'scoring_model', modelId, 'activate', null, { status: 'active' })
  return updated
}

/** Aggregate portal-wide analytics for the internal dashboard. */
export async function buildAnalytics(store: Store, auth: AuthPayload): Promise<any> {
  if (!can(auth, 'view_analytics')) throw forbidden()
  const [companies, requests, runs, users] = await Promise.all([
    store.list('companies', {}),
    store.list('service_requests', {}),
    store.list('calculator_runs', {}),
    store.list('users', {}),
  ])
  const byKey = (arr: any[], key: string) => arr.reduce((acc: any, x: any) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {})
  const partners = companies.filter((c: any) => c.companyType !== 'sigenic')
  const openRequests = requests.filter((r: any) => !['closed'].includes(r.status))
  const consultations = requests.filter((r: any) => r.requestType === 'consultation' || r.source === 'calculator_cta')
  const deptCounts = byKey(runs.filter((r: any) => r.departmentId), 'departmentId')
  return {
    counts: {
      companies: companies.length,
      partners: partners.length,
      activePartners: partners.filter((c: any) => c.status === 'active').length,
      prospects: partners.filter((c: any) => c.status === 'prospect').length,
      users: users.length,
      openRequests: openRequests.length,
      calculatorRuns: runs.length,
      calcToConsultation: consultations.length,
    },
    requestsByType: byKey(requests, 'requestType'),
    requestsByStatus: byKey(requests, 'status'),
    requestsByOwner: byKey(requests, 'ownerTeam'),
    runsByDepartment: deptCounts,
    topPartners: partners
      .map((c: any) => ({ id: c.id, name: c.companyName, type: c.companyType, requests: requests.filter((r: any) => r.companyId === c.id).length, runs: runs.filter((r: any) => r.companyId === c.id).length }))
      .sort((a: any, b: any) => b.requests + b.runs - (a.requests + a.runs))
      .slice(0, 8),
  }
}
