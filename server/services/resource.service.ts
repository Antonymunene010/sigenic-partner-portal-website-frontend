import { can, type Capability } from '../../shared/permissions'
import { forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import { recomputeOnboardingStatus } from './onboarding.service'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

interface ResourceCfg {
  table: string
  manage: Capability
  read: Capability | null
  entity: string
  prefix: string
  companyScoped?: boolean
}

/** Config-driven admin resources: one CRUD shape, role + company-scope per entry.
 *  Contract — entries assume an `id`-keyed primary key, the generic insert/update/
 *  remove store methods, and the full create/read/update/delete shape. Resources
 *  that deviate (e.g. email_templates — slug-keyed, no create/delete, defaults
 *  live in code) get their own service rather than special-casing this registry. */
export const RESOURCES: Record<string, ResourceCfg> = {
  companies: { table: 'companies', manage: 'manage_companies', read: 'view_all_companies', entity: 'company', prefix: 'co' },
  sites: { table: 'sites', manage: 'manage_companies', read: 'view_all_companies', entity: 'site', prefix: 'site', companyScoped: true },
  // Master-data taxonomy is managed on the same super-admin-only screen as the
  // scoring engine, so writes require manage_scoring. Reads are public (read: null,
  // like knowledge/stories): the taxonomy ships to every client via hydrate, so
  // gating the REST list endpoint would be a no-op fiction.
  departments: { table: 'departments', manage: 'manage_scoring', read: null, entity: 'department', prefix: 'dep' },
  processes: { table: 'processes', manage: 'manage_scoring', read: null, entity: 'process', prefix: 'proc' },
  machines: { table: 'machines', manage: 'manage_scoring', read: null, entity: 'machine', prefix: 'mac' },
  'scoring-models': { table: 'scoring_models', manage: 'manage_scoring', read: 'manage_scoring', entity: 'scoring_model', prefix: 'sm' },
  'calculator-issues': { table: 'calculator_issues', manage: 'manage_scoring', read: 'manage_scoring', entity: 'calculator_issue', prefix: 'iss' },
  'occurrence-options': { table: 'occurrence_options', manage: 'manage_scoring', read: 'manage_scoring', entity: 'occurrence_option', prefix: 'occ' },
  'detection-options': { table: 'detection_options', manage: 'manage_scoring', read: 'manage_scoring', entity: 'detection_option', prefix: 'det' },
  'technology-prices': { table: 'technology_prices', manage: 'manage_scoring', read: 'manage_scoring', entity: 'technology_price', prefix: 'tp' },
  'knowledge-articles': { table: 'knowledge_articles', manage: 'manage_knowledge', read: null, entity: 'knowledge_article', prefix: 'kb' },
  'success-stories': { table: 'success_stories', manage: 'manage_success_stories', read: null, entity: 'success_story', prefix: 'story' },
  invoices: { table: 'invoices', manage: 'manage_billing', read: 'view_all_companies', entity: 'invoice', prefix: 'inv', companyScoped: true },
  // Request-form taxonomy — its OWN super-admin capability (manage_request_config),
  // independent of the calculator's manage_scoring. Reads are public (read: null):
  // ships to every client via hydrate, like the calculator master data above.
  'request-types': { table: 'request_types', manage: 'manage_request_config', read: null, entity: 'request_type', prefix: 'rt' },
  'request-departments': { table: 'request_departments', manage: 'manage_request_config', read: null, entity: 'request_department', prefix: 'rdep' },
  'request-processes': { table: 'request_processes', manage: 'manage_request_config', read: null, entity: 'request_process', prefix: 'rproc' },
  'request-machines': { table: 'request_machines', manage: 'manage_request_config', read: null, entity: 'request_machine', prefix: 'rmac' },
}

export function isResource(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(RESOURCES, name)
}

export async function listResource(store: Store, auth: AuthPayload, resource: string): Promise<{ items: any[] }> {
  const cfg = RESOURCES[resource]
  if (cfg.read && !can(auth, cfg.read)) {
    // Company-scoped fallback: a user without the global read cap still sees their own company's rows.
    if (cfg.companyScoped && auth.companyId) {
      const rows = await store.list(cfg.table, { where: 'company_id = $1', params: [auth.companyId], order: 'created_at DESC' })
      return { items: rows }
    }
    throw forbidden()
  }
  return { items: await store.list(cfg.table, { order: 'created_at DESC' }) }
}

export async function createResource(store: Store, auth: AuthPayload, resource: string, body: any): Promise<any> {
  const cfg = RESOURCES[resource]
  if (!can(auth, cfg.manage)) throw forbidden()
  const item = body.item ?? body
  const newId = item.id ?? uid(cfg.prefix)
  const created = await store.insert(cfg.table, { ...item, id: newId })
  await audit(store, auth, cfg.entity, newId, 'create', null, created)
  if (resource === 'companies') await recomputeOnboardingStatus(store, newId)
  return created
}

export async function updateResource(store: Store, auth: AuthPayload, resource: string, id: string, body: any): Promise<any> {
  const cfg = RESOURCES[resource]
  if (!can(auth, cfg.manage)) throw forbidden()
  const before = await store.getOne(cfg.table, id)
  if (!before) throw notFound('Not found.')
  const updated = await store.update(cfg.table, id, body.item ?? body, { touch: body.touch })
  await audit(store, auth, cfg.entity, id, 'update', before, updated)
  // Editing a company's profile fields (country/website/billing) can flip its
  // onboarding stage — let the recompute helper decide. Cheap no-op when nothing
  // relevant changed.
  if (resource === 'companies') await recomputeOnboardingStatus(store, id)
  return updated
}

export async function deleteResource(store: Store, auth: AuthPayload, resource: string, id: string): Promise<{ ok: boolean }> {
  const cfg = RESOURCES[resource]
  if (!can(auth, cfg.manage)) throw forbidden()
  const before = await store.getOne(cfg.table, id)
  const ok = await store.remove(cfg.table, id)
  await audit(store, auth, cfg.entity, id, 'delete', before, null)
  return { ok }
}
