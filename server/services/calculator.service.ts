import { computeRisk, toCalculatorRun } from '../../shared/calc'
import { badRequest } from '../http/errors'
import { uid, nowIso } from '../util/ids'
import { calculatorLeadEmail, calculatorSubmissionReceiptEmail, notifyInternalAdmins, sendEmail } from '../infra/email'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'
import type {
  CalcAdditionalInfo,
  CalcSelection,
  CompanyType,
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
 * Step 2 ("Statistical Analysis"); persistence happens on submit().
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

/**
 * Shared persistence + notification path for "Submit and Send Email". Re-runs the
 * calculation server-side (never trusts the client's stat-page numbers), inserts a
 * calculator_runs row, then fans the submission out to internal admins AND emails
 * the submitter their own confirmation receipt. Both sends are fire-and-forget —
 * they must not gate the wizard's confirmation screen.
 */
async function persistSubmission(
  store: Store,
  params: {
    selection: CalcSelection
    runType: 'partner' | 'distributor' | 'internal'
    ids: { companyId?: string | null; siteId?: string | null; userId?: string | null }
    modelId?: string
    additional?: CalcAdditionalInfo | null
    clientName?: string | null
    submitterName?: string | null
    submitterEmail?: string | null
    recipientName?: string | null
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
      contact: null,
      clientName: params.clientName ?? null,
    }),
    id: runId,
    submitted_at: submittedAt,
  })
  // Two independent best-effort fan-outs: admins get the lead notification, the
  // submitter gets a confirmation receipt (when their email is known). Both
  // template renders + sends are kicked off in parallel and never awaited so the
  // wizard's confirmation screen returns the moment the run is persisted.
  // Calculator lead / receipt mail flows through the sales mailbox (client
  // request 2026-06-27: ROI from sigenic_sales@, user management from noreply@)
  // so replies land with the sales team that follows up on the lead.
  void calculatorLeadEmail(store, {
    runId,
    result,
    submitterName: params.submitterName,
    submitterEmail: params.submitterEmail,
    additional: params.additional ?? null,
  })
    .then((msg) => notifyInternalAdmins(store, msg, { from: 'sales' }))
    .catch(() => {})
  if (params.submitterEmail) {
    const to = params.submitterEmail
    void calculatorSubmissionReceiptEmail(store, { recipientName: params.recipientName, runId, result })
      .then((msg) => sendEmail(store, { to, ...msg }, { from: 'sales' }))
      .catch(() => {})
  }
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
    // submitterName labels the lead on the admin notify (may be the client name);
    // recipientName greets the submitter on their own receipt (always the account name).
    submitterName: clientName ?? auth.name,
    submitterEmail: auth.email,
    recipientName: auth.name,
  })
}
