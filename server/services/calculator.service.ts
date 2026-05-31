import { computeRoi, toCalculatorRun, toLimited } from '../../shared/calc'
import { isInternal, can } from '../../shared/permissions'
import { badRequest, forbidden } from '../http/errors'
import { audit } from './audit'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type { CalcSelection } from '../../shared/types'

/** Full ROI calculation. Anyone may compute; only some roles may persist (save). */
export async function calculate(
  store: Store,
  auth: AuthPayload,
  { selection = {}, modelId, save }: { selection?: CalcSelection; modelId?: string; save?: boolean },
): Promise<{ result: any; run: any }> {
  const model = modelId ? await store.getOne('scoring_models', modelId) : await store.getActiveScoringModel()
  if (!model) throw badRequest('No scoring model available.')
  const rules = await store.getRulesForModel(model.id)
  const companyId = isInternal(auth) ? selection.companyId ?? auth.companyId : auth.companyId
  const assumption = await store.resolveAssumption(model.id, companyId, selection.siteId)
  const result = computeRoi({ model, rules, assumption, selection })
  let run = null
  if (save) {
    if (!can(auth, 'save_calculator_result')) throw forbidden('Your role cannot save calculator results.')
    const runType = isInternal(auth) ? 'internal' : auth.userType === 'distributor' ? 'distributor' : 'partner'
    run = await store.insert('calculator_runs', {
      ...toCalculatorRun({ result, selection, runType, model, ids: { companyId, siteId: selection.siteId, userId: auth.sub } }),
      id: uid('run'),
    })
    await audit(store, auth, 'calculator_run', run.id, 'save', null, { score: result.score })
  }
  return { result, run }
}

/** Public/limited ROI teaser — persists an anonymous run, returns a trimmed result. */
export async function publicCalculate(store: Store, selection: CalcSelection | undefined): Promise<{ result: any }> {
  const model = await store.getActiveScoringModel()
  if (!model) throw badRequest('No active scoring model configured.')
  const rules = await store.getRulesForModel(model.id)
  const assumption = await store.resolveAssumption(model.id, null, null)
  const result = computeRoi({ model, rules, assumption, selection: selection ?? {} })
  await store
    .insert('calculator_runs', { ...toCalculatorRun({ result, selection: selection ?? {}, runType: 'public', model, ids: {} }), id: uid('run') })
    .catch(() => {})
  return { result: toLimited(result) }
}
