import { computeRisk, toCalculatorRun, toLimited } from '../../shared/calc'
import { badRequest } from '../http/errors'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { CalcSelection } from '../../shared/types'

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

/** Full risk + yield-loss calculation for an authenticated user (computed live, not persisted). */
export async function calculate(
  store: Store,
  { selection = {}, modelId }: { selection?: CalcSelection; modelId?: string },
): Promise<{ result: any }> {
  const model = modelId ? await store.getOne('scoring_models', modelId) : await store.getActiveScoringModel()
  if (!model) throw badRequest('No scoring model available.')
  const result = await buildResult(store, model, selection)
  return { result }
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
