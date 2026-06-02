import { createZendeskTicket, addZendeskComment, syncZendeskTicket, zendeskEnabled } from '../integration/zendesk'
import { sendEmail, ticketCreatedEmail, ticketUpdatedEmail } from '../infra/email'
import { isInternal, can, canSeeCompany } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import { uid, nowIso } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

const URGENCY_TO_PRIORITY: Record<string, string> = { low: 'low', medium: 'normal', high: 'high' }

/** Create the linked Zendesk ticket for a support request; returns its id or null. */
async function createZendeskForRequest(payload: any): Promise<string | null> {
  const ticket = {
    id: payload.id,
    subject: payload.title,
    requester: payload.contact_name ?? 'Partner',
    requesterEmail: payload.contact_email,
    priority: URGENCY_TO_PRIORITY[payload.urgency] ?? 'normal',
    status: 'open',
    tags: [payload.request_type],
    messages: payload.messages ?? [],
  }
  try {
    const zd = await createZendeskTicket(ticket)
    return zd?.id ? String(zd.id) : null
  } catch (error: any) {
    console.warn(`[zendesk:create] ${payload.id}: ${error.message}`)
    return null
  }
}

/** Notify a request's owner of an update — email (MVP) + in-app, per PRD §7.7. */
async function notifyRequester(store: Store, request: any, body: string, author: string): Promise<void> {
  // Email + in-app are independent — fan them out concurrently (mirrors announcement.service).
  await Promise.all([
    request.contactEmail
      ? sendEmail(store, {
          to: request.contactEmail,
          ...ticketUpdatedEmail({ id: request.id, subject: request.title, status: request.status }, { author, body }),
        }).catch(() => {})
      : null,
    request.userId
      ? store
          .appendNotification({
            id: uid('ntf'),
            userId: request.userId,
            companyId: request.companyId ?? null,
            kind: 'request',
            title: `Request update: ${request.title}`,
            body,
            link: `/app/requests/${request.id}`,
          })
          .catch(() => {})
      : null,
  ])
}

/** Open a linked Zendesk ticket for a request payload and, on success, flip it to 'open'. */
async function openZendeskTicket(payload: any): Promise<void> {
  const zid = await createZendeskForRequest(payload)
  if (zid) {
    payload.zendesk_ticket_id = zid
    payload.status = 'open'
  }
}

/** Create a portal service request (every type opens a linked Zendesk ticket, per PRD §5/§8). */
export async function createServiceRequest(store: Store, auth: AuthPayload, request: any): Promise<any> {
  if (!request?.title || !request?.requestType) throw badRequest('Request type and title are required.')
  if (request.requestType === 'support' && !can(auth, 'submit_support_request')) throw forbidden()
  const companyId = isInternal(auth) ? request.companyId ?? auth.companyId : auth.companyId
  const messages = [{ id: uid('m'), author: auth.name, authorRole: 'you', body: request.description ?? request.title, createdAt: nowIso() }]
  const payload: any = {
    id: uid('sr'),
    company_id: companyId ?? null,
    site_id: request.siteId ?? null,
    user_id: auth.sub,
    request_type: request.requestType,
    title: request.title,
    description: request.description ?? '',
    department_id: request.departmentId ?? null,
    process_id: request.processId ?? null,
    machine_id: request.machineId ?? null,
    urgency: request.urgency ?? 'medium',
    status: 'new',
    source: request.source ?? 'portal_form',
    owner_team: store.ownerTeamFor(request.requestType),
    linked_calculator_run_id: request.linkedCalculatorRunId ?? null,
    contact_name: request.contactName ?? auth.name,
    contact_email: request.contactEmail ?? auth.email,
    messages,
  }
  // Every request type opens a linked Zendesk ticket so it reaches the team (PRD §5/§8).
  await openZendeskTicket(payload)
  const created = await store.insert('service_requests', payload)
  await audit(store, auth, 'service_request', created.id, 'create', null, { type: created.requestType, owner: created.ownerTeam })
  if (payload.contact_email) {
    await sendEmail(store, {
      to: payload.contact_email,
      ...ticketCreatedEmail({ id: created.id, subject: created.title, requester: created.contactName, category: created.requestType, priority: created.urgency }),
    }).catch(() => {})
  }
  return created
}

/** Append a message to a thread (reopening a closed request), mirroring to Zendesk + email. */
export async function addServiceRequestMessage(store: Store, auth: AuthPayload, id: string, rawBody: string): Promise<any> {
  if (!rawBody?.trim()) throw badRequest('Message body is required.')
  const current = await store.getOne('service_requests', id)
  if (!current) throw notFound('Request not found.')
  if (!isInternal(auth) && !canSeeCompany(auth, current.companyId)) throw forbidden()
  const message = { id: uid('m'), author: auth.name, authorRole: isInternal(auth) ? 'agent' : 'you', body: rawBody.trim(), createdAt: nowIso() }
  const reopen = current.status === 'closed'
  const updated = await store.addServiceRequestMessage(id, message, reopen ? 'open' : current.status)
  if (current.zendeskTicketId) {
    await addZendeskComment(current.zendeskTicketId, message.body, auth.name).catch((e: any) => console.warn(`[zendesk:comment] ${e.message}`))
  }
  const notify = updated.contactEmail ?? auth.email
  if (notify) await sendEmail(store, { to: notify, ...ticketUpdatedEmail({ id: updated.id, subject: updated.title, status: updated.status }, message) }).catch(() => {})
  return updated
}

/** Internal-only status/owner update for a request. */
export async function updateServiceRequest(store: Store, auth: AuthPayload, id: string, patch: any): Promise<any> {
  if (!can(auth, 'view_ticket_oversight')) throw forbidden('Only internal staff can update request status.')
  const before = await store.getOne('service_requests', id)
  if (!before) throw notFound('Request not found.')
  const updated = await store.update('service_requests', id, patch)
  await audit(store, auth, 'service_request', id, 'update', { status: before.status, ownerTeam: before.ownerTeam }, { status: updated.status, ownerTeam: updated.ownerTeam })
  // Notify the requester when status changes (PRD §7.7: email MVP + in-app).
  if (updated.status !== before.status) {
    await notifyRequester(store, updated, `Status changed to ${updated.status}.`, auth.name)
  }
  return updated
}

/** Pull status + agent comments for every Zendesk-linked request. No auth check (scheduler). */
export async function runZendeskSync(store: Store): Promise<{ synced: number; mode?: string }> {
  if (!zendeskEnabled()) return { synced: 0, mode: 'mock' }
  const linked = await store.getZendeskLinkedRequests()
  let synced = 0
  for (const row of linked) {
    try {
      const result = await syncZendeskTicket(row.zendeskTicketId)
      if (!result) continue
      const applied = await store.applyZendeskSync(row.zendeskTicketId, result)
      if (!applied || (!applied.newComments && !applied.statusChanged)) continue
      synced++
      // A new agent reply was pulled in → notify the requester (PRD §7.7).
      if (applied.newComments > 0) await notifyRequester(store, applied.request, 'Sigenic replied to your request.', 'Sigenic Support')
    } catch (error: any) {
      console.warn(`[zendesk:sync] ${row.id}: ${error.message}`)
    }
  }
  return { synced }
}

/** Authenticated, permission-gated trigger for the Zendesk sync. */
export async function triggerZendeskSync(store: Store, auth: AuthPayload): Promise<{ synced: number; mode?: string }> {
  if (!can(auth, 'view_ticket_oversight')) throw forbidden()
  return runZendeskSync(store)
}

/** Public (unauthenticated) lead/demo/consultation request from the marketing site. */
export async function createPublicLead(store: Store, request: any): Promise<{ id: string; status: string }> {
  if (!request?.contactEmail || !request?.title) throw badRequest('Name, email and message are required.')
  const requestType = ['demo', 'consultation'].includes(request.requestType) ? request.requestType : 'demo'
  const payload: any = {
    id: uid('sr'),
    company_id: null,
    user_id: null,
    request_type: requestType,
    title: request.title,
    description: request.description ?? '',
    urgency: 'medium',
    status: 'new',
    source: 'landing_page',
    owner_team: store.ownerTeamFor(requestType),
    contact_name: request.contactName ?? null,
    contact_email: request.contactEmail,
    interest_type: request.interestType ?? null,
    messages: [{ id: uid('m'), author: request.contactName ?? 'Lead', authorRole: 'you', body: request.description ?? request.title, createdAt: nowIso() }],
  }
  // Open a linked Zendesk ticket so the lead actually reaches the team — previously a
  // public lead was only stored locally with no outbound notification whatsoever.
  await openZendeskTicket(payload)
  const created = await store.insert('service_requests', payload)
  await sendEmail(store, {
    to: request.contactEmail,
    ...ticketCreatedEmail({ id: created.id, subject: created.title, requester: created.contactName ?? 'there', category: requestType, priority: 'medium' }),
  }).catch(() => {})
  await audit(store, null, 'service_request', created.id, 'public_lead', null, { contact: request.contactEmail })
  return { id: created.id, status: created.status }
}
