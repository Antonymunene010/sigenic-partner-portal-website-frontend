import { computeRisk, toCalculatorRun, toLimited } from '../../shared/calc'
import { badRequest } from '../http/errors'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { CalcSelection, CompanyType } from '../../shared/types'

/** Load the global Configuration lookups (occurrence/detection scores, tech prices). */
async function loadConfig(store: Store) {
  const [occurrenceOptions, detectionOptions, technologyPrices] = await Promise.all([
    store.list('occurrence_options', { order: 'sort_order ASC' }),
    store.list('detection_options', { order: 'sort_order ASC' }),
    store.list('technology_prices', { order: 'technology ASC' }),
  ])
  return { occurrenceOptions, detectionOptions, technologyPrices }
}

/** Resolve the issue catalog + department + configuration for a model and run the engine. */
async function buildResult(store: Store, model: any, selection: CalcSelection) {
  // Independent reads — fan out concurrently (loadConfig itself is a Promise.all).
  const [department, issues, config] = await Promise.all([
    selection.departmentId ? store.getOne('departments', selection.departmentId) : Promise.resolve(null),
    store.getIssuesForModel(model.id, selection.departmentId),
    loadConfig(store),
  ])
  return computeRisk({ model, department, issues, ...config, selection })
}

/** Map the caller's company type to a calculator_runs.run_type (CHECK: public|partner|distributor|internal). */
function runTypeFor(companyType: CompanyType | null | undefined): 'partner' | 'distributor' | 'internal' {
  if (companyType === 'sigenic') return 'internal'
  if (companyType === 'distributor') return 'distributor'
  return 'partner' // customers (and any unknown) are external partner leads
}

/**
 * Full risk + yield-loss calculation for an authenticated user. The run is persisted
 * as a lead (run_type by company type) so internal staff can follow up for GTM; the
 * row id is returned so a follow-on consultation request can link back to it.
 */
export async function calculate(
  store: Store,
  auth: AuthPayload,
  { selection = {}, modelId }: { selection?: CalcSelection; modelId?: string },
): Promise<{ result: any; runId: string | null }> {
  const model = modelId ? await store.getOne('scoring_models', modelId) : await store.getActiveScoringModel()
  if (!model) throw badRequest('No scoring model available.')
  const result = await buildResult(store, model, selection)
  // Persist the run as a sales lead — best-effort, mirroring publicCalculate: a logging
  // failure must never fail the calculation the user asked for.
  const runId = uid('run')
  const ok = await store
    .insert('calculator_runs', {
      ...toCalculatorRun({
        result,
        selection,
        runType: runTypeFor(auth.companyType),
        model,
        ids: { companyId: auth.companyId, siteId: selection.siteId ?? null, userId: auth.sub },
      }),
      id: runId,
    })
    .then(() => true)
    .catch(() => false)
  return { result, runId: ok ? runId : null }
}

/** Public/limited teaser — persists an anonymous run, returns a trimmed result. */
export async function publicCalculate(store: Store, selection: CalcSelection | undefined): Promise<{ result: any }> {
  const model = await store.getActiveScoringModel()
  if (!model) throw badRequest('No active scoring model configured.')
  const result = await buildResult(store, model, selection ?? {})
  await store
    .insert('calculator_runs', { ...toCalculatorRun({ result, selection: selection ?? {}, runType: 'public', model, ids: {} }), id: uid('run') })
    .catch(() => {})
  return { result: toLimited(result) }
}

/**
 * Public calculator metadata for the unauthenticated teaser: the active model's
 * departments + issue catalog + dropdown options. Wafer prices stay server-side.
 */
export async function publicConfig(store: Store): Promise<any> {
  const model = await store.getActiveScoringModel()
  if (!model) return { model: null, departments: [], issues: [], occurrenceOptions: [], detectionOptions: [] }
  const [departments, issues, occurrenceOptions, detectionOptions] = await Promise.all([
    store.list('departments', { where: 'active = true', order: 'name ASC' }),
    store.getIssuesForModel(model.id),
    store.list('occurrence_options', { where: 'active = true', order: 'sort_order ASC' }),
    store.list('detection_options', { where: 'active = true', order: 'sort_order ASC' }),
  ])
  return {
    model: { id: model.id, versionName: model.versionName },
    departments: departments.map((d: any) => ({ id: d.id, name: d.name, technology: d.technology })),
    issues: issues
      .filter((i: any) => i.active)
      .map((i: any) => ({
        id: i.id,
        departmentId: i.departmentId,
        label: i.label,
        defaultSeverity: i.defaultSeverity,
        defaultOccurrence: i.defaultOccurrence,
        defaultDetection: i.defaultDetection,
        sortOrder: i.sortOrder,
      })),
    occurrenceOptions,
    detectionOptions,
  }
}
