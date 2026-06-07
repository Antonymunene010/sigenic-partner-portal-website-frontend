import { computeRisk, toCalculatorRun, toLimited } from '../../shared/calc'
import { badRequest } from '../http/errors'
import { uid, nowIso } from '../util/ids'
import { calculatorLeadEmail, notifyInternalAdmins } from '../infra/email'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type {
  CalcAdditionalInfo,
  CalcContact,
  CalcSelection,
  CompanyType,
  LimitedRiskResult,
  RiskResult,
} from '../../shared/types'

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
async function buildResult(store: Store, model: any, selection: CalcSelection): Promise<RiskResult> {
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
  return 'partner'
}

/**
 * Pure calculation — no persistence, no email. The wizard previews the score on
 * Step 2 ("Statistical Analysis"); persistence happens on submit/publicSubmit.
 */
export async function calculate(
  store: Store,
  _auth: AuthPayload,
  { selection = {}, modelId }: { selection?: CalcSelection; modelId?: string },
): Promise<{ result: RiskResult }> {
  const model = modelId ? await store.getOne('scoring_models', modelId) : await store.getActiveScoringModel()
  if (!model) throw badRequest('No scoring model available.')
  return { result: await buildResult(store, model, selection) }
}

/** Public/limited teaser — stateless. Persistence happens on publicSubmit(). */
export async function publicCalculate(
  store: Store,
  selection: CalcSelection | undefined,
): Promise<{ result: LimitedRiskResult }> {
  const model = await store.getActiveScoringModel()
  if (!model) throw badRequest('No active scoring model configured.')
  const result = await buildResult(store, model, selection ?? {})
  return { result: toLimited(result) }
}

/**
 * Shared persistence + notification path for "Submit and Send Email". Re-runs the
 * calculation server-side (never trusts the client's stat-page numbers), inserts
 * a calculator_runs row, and fans the submission out to internal admins. The
 * admin notify is fire-and-forget — it must not gate the wizard's confirmation.
 */
async function persistSubmission(
  store: Store,
  params: {
    selection: CalcSelection
    runType: 'partner' | 'distributor' | 'internal' | 'public'
    ids: { companyId?: string | null; siteId?: string | null; userId?: string | null }
    modelId?: string
    additional?: CalcAdditionalInfo | null
    contact?: CalcContact | null
    clientName?: string | null
    submitterName?: string | null
    submitterEmail?: string | null
    companyName?: string | null
  },
): Promise<{ result: RiskResult; runId: string; submittedAt: string }> {
  const model = params.modelId ? await store.getOne('scoring_models', params.modelId) : await store.getActiveScoringModel()
  if (!model) throw badRequest('No scoring model available.')
  const result = await buildResult(store, model, params.selection)
  const runId = uid('run')
  const submittedAt = nowIso()
  await store.insert('calculator_runs', {
    ...toCalculatorRun({
      result,
      selection: params.selection,
      runType: params.runType,
      model,
      ids: params.ids,
      additional: params.additional ?? null,
      contact: params.contact ?? null,
      clientName: params.clientName ?? null,
    }),
    id: runId,
    submitted_at: submittedAt,
  })
  notifyInternalAdmins(store, calculatorLeadEmail({
    runId,
    result,
    submitterName: params.submitterName,
    submitterEmail: params.submitterEmail,
    companyName: params.companyName,
    additional: params.additional ?? null,
  })).catch(() => {})
  return { result, runId, submittedAt }
}

/** Final wizard step for an authenticated user ("Submit and Send Email"). */
export async function submit(
  store: Store,
  auth: AuthPayload,
  body: {
    selection?: CalcSelection
    additional?: CalcAdditionalInfo
    clientName?: string
    modelId?: string
  },
): Promise<{ result: RiskResult; runId: string; submittedAt: string }> {
  const selection = body.selection ?? {}
  const clientName = body.clientName?.trim() || null
  return persistSubmission(store, {
    selection,
    runType: runTypeFor(auth.companyType),
    ids: { companyId: auth.companyId, siteId: selection.siteId ?? null, userId: auth.sub },
    modelId: body.modelId,
    additional: body.additional ?? null,
    clientName,
    submitterName: clientName ?? auth.name,
    submitterEmail: auth.email,
  })
}

/**
 * Unauthenticated wizard submit — requires a contact card so admins can follow up.
 * Returns the trimmed (public-safe) result + the documentation id.
 */
export async function publicSubmit(
  store: Store,
  body: {
    selection?: CalcSelection
    additional?: CalcAdditionalInfo
    contact?: CalcContact
  },
): Promise<{ result: LimitedRiskResult; runId: string; submittedAt: string }> {
  const contact = body.contact
  if (!contact?.clientName?.trim() || !contact?.contactEmail?.trim()) {
    throw badRequest('Client name and contact email are required to submit.')
  }
  const out = await persistSubmission(store, {
    selection: body.selection ?? {},
    runType: 'public',
    ids: {},
    additional: body.additional ?? null,
    contact,
    submitterName: contact.contactName || contact.clientName,
    submitterEmail: contact.contactEmail,
    companyName: contact.companyName ?? null,
  })
  return { ...out, result: toLimited(out.result) }
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
