import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createStore } from './store.js'
import { bearerToken, signToken, verifyToken, verifyPassword } from './infra/auth'
import {
  can,
  isInternal,
  canSeeCompany,
  canManageUser,
  roleMeta,
} from '../shared/permissions'
import {
  initEmail,
  emailMode,
  sendEmail,
  ticketCreatedEmail,
  ticketUpdatedEmail,
  announcementEmail,
} from './infra/email'
import {
  createZendeskTicket,
  addZendeskComment,
  syncZendeskTicket,
  zendeskEnabled,
} from './integration/zendesk'
import { fetchNotionArticles, notionEnabled } from './integration/notion'
import { computeRoi, toCalculatorRun, toLimited } from '../shared/calc'
import { invoicePdf, reportPdf } from './infra/pdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
loadEnvFile(path.join(root, '.env'))

const port = Number(process.env.PORT ?? 8787)
const store = createStore()
const uid = (prefix) => `${prefix}-${crypto.randomBytes(6).toString('hex')}`
const nowIso = () => new Date().toISOString()
const URGENCY_TO_PRIORITY = { low: 'low', medium: 'normal', high: 'high' }

/* ----- http helpers ----- */

function send(res, status, body, headers = {}) {
  if (res.headersSent || res.writableEnded) return // response already sent — never double-write headers
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    ...headers,
  })
  res.end(JSON.stringify(body))
}
function sendBuffer(res, status, buffer, contentType, filename) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  })
  res.end(buffer)
}
const reply400 = (res, msg) => (send(res, 400, { error: msg }), true)
const notFound = (res, msg) => (send(res, 404, { error: msg }), true)
const forbidden = (res, msg) => (send(res, 403, { error: msg ?? 'Not allowed.' }), true)

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 5_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON payload'))
      }
    })
    req.on('error', reject)
  })
}
function routePath(req) {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname
}
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] == null) process.env[key] = value
  }
}
function authUserFrom(req) {
  const token = bearerToken(req)
  return token ? verifyToken(token) : null
}
async function audit(auth, entityType, entityId, action, oldVal, newVal) {
  await store
    .appendAudit({
      id: uid('al'),
      user_id: auth?.sub ?? null,
      actor_name: auth?.name ?? 'system',
      entity_type: entityType,
      entity_id: entityId ?? null,
      action,
      old_value_json: oldVal ?? null,
      new_value_json: newVal ?? null,
    })
    .catch(() => {})
}

/* ----- Zendesk two-way sync (service_requests) ----- */

async function runZendeskSync() {
  if (!zendeskEnabled()) return { synced: 0, mode: 'mock' }
  const linked = await store.getZendeskLinkedRequests()
  let synced = 0
  for (const row of linked) {
    try {
      const result = await syncZendeskTicket(row.zendeskTicketId)
      if (result && (await store.applyZendeskSync(row.zendeskTicketId, result))) synced++
    } catch (error) {
      console.warn(`[zendesk:sync] ${row.id}: ${error.message}`)
    }
  }
  return { synced }
}

/* ----- Notion → knowledge_articles sync ----- */

async function runNotionSync() {
  if (!notionEnabled()) return { synced: 0, mode: 'mock' }
  const articles = await fetchNotionArticles()
  let synced = 0
  for (const article of articles) {
    try {
      await store.upsertNotionArticle(article)
      synced++
    } catch (error) {
      console.warn(`[notion:sync] ${article.sourceRefId}: ${error.message}`)
    }
  }
  return { synced }
}

/**
 * Run `fn` on a fixed interval with NO overlapping cycles: the next run is
 * armed only after the current one settles, so a slow sync can't stack up the
 * way a plain setInterval would. Fires once immediately.
 */
function scheduleLoop(fn, intervalMs, label) {
  const tick = async () => {
    try {
      await fn()
    } catch (error) {
      console.warn(`[${label}] cycle failed: ${error.message}`)
    } finally {
      setTimeout(tick, intervalMs).unref()
    }
  }
  tick()
}

/* ----- request → Zendesk ticket helper ----- */

async function createZendeskForRequest(payload) {
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
  } catch (error) {
    console.warn(`[zendesk:create] ${payload.id}: ${error.message}`)
    return null
  }
}

/* ----- generic admin resource registry ----- */

const RESOURCES = {
  companies: { table: 'companies', manage: 'manage_companies', read: 'view_all_companies', entity: 'company', prefix: 'co' },
  sites: { table: 'sites', manage: 'manage_companies', read: 'view_all_companies', entity: 'site', prefix: 'site', companyScoped: true },
  departments: { table: 'departments', manage: 'manage_master_data', read: 'view_master_data', entity: 'department', prefix: 'dep' },
  processes: { table: 'processes', manage: 'manage_master_data', read: 'view_master_data', entity: 'process', prefix: 'proc' },
  machines: { table: 'machines', manage: 'manage_master_data', read: 'view_master_data', entity: 'machine', prefix: 'mac' },
  'scoring-models': { table: 'scoring_models', manage: 'manage_scoring', read: 'manage_scoring', entity: 'scoring_model', prefix: 'sm' },
  'scoring-rules': { table: 'scoring_rules', manage: 'manage_scoring', read: 'manage_scoring', entity: 'scoring_rule', prefix: 'sr-rule' },
  'financial-assumptions': { table: 'financial_assumptions', manage: 'manage_scoring', read: 'manage_scoring', entity: 'financial_assumption', prefix: 'fa' },
  'knowledge-articles': { table: 'knowledge_articles', manage: 'manage_knowledge', read: null, entity: 'knowledge_article', prefix: 'kb' },
  'success-stories': { table: 'success_stories', manage: 'manage_success_stories', read: null, entity: 'success_story', prefix: 'story' },
  invoices: { table: 'invoices', manage: 'manage_billing', read: 'view_all_companies', entity: 'invoice', prefix: 'inv', companyScoped: true },
}

async function handleResource(req, res, auth, resource, id) {
  const cfg = RESOURCES[resource]
  if (!cfg) return false

  if (!id && req.method === 'GET') {
    if (cfg.read && !can(auth, cfg.read)) {
      if (cfg.companyScoped && auth.companyId) {
        const rows = await store.list(cfg.table, { where: 'company_id = $1', params: [auth.companyId], order: 'created_at DESC' })
        return send(res, 200, { items: rows })
      }
      return forbidden(res)
    }
    return send(res, 200, { items: await store.list(cfg.table, { order: 'created_at DESC' }) })
  }

  if (!id && req.method === 'POST') {
    if (!can(auth, cfg.manage)) return forbidden(res)
    const body = await readJson(req)
    const item = body.item ?? body
    const newId = item.id ?? uid(cfg.prefix)
    const created = await store.insert(cfg.table, { ...item, id: newId })
    await audit(auth, cfg.entity, newId, 'create', null, created)
    return send(res, 201, { item: created })
  }

  if (id && req.method === 'PATCH') {
    if (!can(auth, cfg.manage)) return forbidden(res)
    const body = await readJson(req)
    const before = await store.getOne(cfg.table, id)
    if (!before) return notFound(res, 'Not found.')
    const updated = await store.update(cfg.table, id, body.item ?? body, { touch: body.touch })
    await audit(auth, cfg.entity, id, 'update', before, updated)
    return send(res, 200, { item: updated })
  }

  if (id && req.method === 'DELETE') {
    if (!can(auth, cfg.manage)) return forbidden(res)
    const before = await store.getOne(cfg.table, id)
    const ok = await store.remove(cfg.table, id)
    await audit(auth, cfg.entity, id, 'delete', before, null)
    return send(res, 200, { ok })
  }
  return false
}

/* ----- public routes (no auth) ----- */

async function handlePublic(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    send(res, 204, {})
    return true
  }
  if (pathname === '/api/health' && req.method === 'GET') {
    send(res, 200, { ok: true, database: await store.health(), zendesk: zendeskEnabled(), notion: notionEnabled(), email: emailMode() })
    return true
  }
  if (pathname === '/api/public' && req.method === 'GET') {
    send(res, 200, await store.publicBundle())
    return true
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await readJson(req)
    if (!email || !password) return reply400(res, 'Email and password are required.')
    const account = await store.getUserAuthByEmail(String(email))
    if (!account) return notFound(res, 'No account found for that email.')
    if (account.status === 'inactive') return forbidden(res, 'This account is deactivated.')
    if (!verifyPassword(password, account.passwordHash)) {
      send(res, 401, { error: 'Incorrect password.' })
      return true
    }
    await store.setLastLogin(account.id)
    const token = signToken({
      sub: account.id,
      role: account.role,
      userType: account.userType,
      companyId: account.companyId,
      companyType: account.companyType,
      email: account.email,
      name: account.fullName,
    })
    const user = await store.getUserById(account.id)
    send(res, 200, { user, token })
    return true
  }
  // Public lead/demo/contact request (PRD public flow) — creates a service_request.
  if (pathname === '/api/public/requests' && req.method === 'POST') {
    const { request } = await readJson(req)
    if (!request?.contactEmail || !request?.title) return reply400(res, 'Name, email and message are required.')
    const requestType = ['demo', 'consultation'].includes(request.requestType) ? request.requestType : 'demo'
    const payload = {
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
    }
    const created = await store.insert('service_requests', payload)
    await sendEmail(store, {
      to: request.contactEmail,
      ...ticketCreatedEmail({ id: created.id, subject: created.title, requester: created.contactName ?? 'there', category: requestType, priority: 'medium' }),
    }).catch(() => {})
    await audit(null, 'service_request', created.id, 'public_lead', null, { contact: request.contactEmail })
    send(res, 201, { item: { id: created.id, status: created.status } })
    return true
  }
  // Public limited calculator (PRD: public sees a teaser only).
  if (pathname === '/api/public/calculate' && req.method === 'POST') {
    const { selection } = await readJson(req)
    const model = await store.getActiveScoringModel()
    if (!model) return reply400(res, 'No active scoring model configured.')
    const rules = await store.getRulesForModel(model.id)
    const assumption = await store.resolveAssumption(model.id, null, null)
    const result = computeRoi({ model, rules, assumption, selection: selection ?? {} })
    // Persist as an anonymous public run.
    await store
      .insert('calculator_runs', { ...toCalculatorRun({ result, selection: selection ?? {}, runType: 'public', model, ids: {} }), id: uid('run') })
      .catch(() => {})
    send(res, 200, { result: toLimited(result) })
    return true
  }
  return false
}

/* ----- authenticated routes ----- */

async function handleApi(req, res, pathname, auth) {
  if (pathname === '/api/hydrate' && req.method === 'GET') {
    return send(res, 200, await store.hydrateFor(auth))
  }
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return send(res, 200, { user: await store.getUserById(auth.sub) })
  }
  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    const { currentPassword, newPassword } = await readJson(req)
    if (!newPassword || String(newPassword).length < 4) return reply400(res, 'New password must be at least 4 characters.')
    const account = await store.getUserAuthByEmail(auth.email)
    if (!account || !verifyPassword(currentPassword, account.passwordHash)) return reply400(res, 'Current password is incorrect.')
    await store.setPassword(account.id, newPassword)
    return send(res, 200, { ok: true })
  }

  /* ---- calculator (full) ---- */
  if (pathname === '/api/calculate' && req.method === 'POST') {
    const { selection = {}, modelId, save } = await readJson(req)
    const model = modelId ? await store.getOne('scoring_models', modelId) : await store.getActiveScoringModel()
    if (!model) return reply400(res, 'No scoring model available.')
    const rules = await store.getRulesForModel(model.id)
    const companyId = isInternal(auth) ? selection.companyId ?? auth.companyId : auth.companyId
    const assumption = await store.resolveAssumption(model.id, companyId, selection.siteId)
    const result = computeRoi({ model, rules, assumption, selection })
    let run = null
    if (save) {
      if (!can(auth, 'save_calculator_result')) return forbidden(res, 'Your role cannot save calculator results.')
      const runType = isInternal(auth) ? 'internal' : auth.userType === 'distributor' ? 'distributor' : 'partner'
      run = await store.insert('calculator_runs', {
        ...toCalculatorRun({ result, selection, runType, model, ids: { companyId, siteId: selection.siteId, userId: auth.sub } }),
        id: uid('run'),
      })
      await audit(auth, 'calculator_run', run.id, 'save', null, { score: result.score })
    }
    return send(res, 200, { result, run })
  }

  /* ---- service requests ---- */
  if (pathname === '/api/service-requests' && req.method === 'POST') {
    const { request } = await readJson(req)
    if (!request?.title || !request?.requestType) return reply400(res, 'Request type and title are required.')
    if (request.requestType === 'support' && !can(auth, 'submit_support_request')) return forbidden(res)
    const companyId = isInternal(auth) ? request.companyId ?? auth.companyId : auth.companyId
    const messages =
      request.requestType === 'support'
        ? [{ id: uid('m'), author: auth.name, authorRole: 'you', body: request.description ?? request.title, createdAt: nowIso() }]
        : []
    const payload = {
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
    if (request.requestType === 'support') {
      const zid = await createZendeskForRequest(payload)
      if (zid) {
        payload.zendesk_ticket_id = zid
        payload.status = 'open'
      }
    }
    const created = await store.insert('service_requests', payload)
    await audit(auth, 'service_request', created.id, 'create', null, { type: created.requestType, owner: created.ownerTeam })
    if (payload.contact_email) {
      await sendEmail(store, {
        to: payload.contact_email,
        ...ticketCreatedEmail({ id: created.id, subject: created.title, requester: created.contactName, category: created.requestType, priority: created.urgency }),
      }).catch(() => {})
    }
    return send(res, 201, { item: created })
  }

  const srMsg = pathname.match(/^\/api\/service-requests\/([^/]+)\/messages$/)
  if (srMsg && req.method === 'POST') {
    const { body } = await readJson(req)
    if (!body?.trim()) return reply400(res, 'Message body is required.')
    const current = await store.getServiceRequestById(srMsg[1])
    if (!current) return notFound(res, 'Request not found.')
    if (!isInternal(auth) && !canSeeCompany(auth, current.companyId)) return forbidden(res)
    const message = { id: uid('m'), author: auth.name, authorRole: isInternal(auth) ? 'agent' : 'you', body: body.trim(), createdAt: nowIso() }
    const reopen = current.status === 'closed'
    const updated = await store.addServiceRequestMessage(srMsg[1], message, reopen ? 'open' : current.status)
    if (current.zendeskTicketId) {
      await addZendeskComment(current.zendeskTicketId, message.body, auth.name).catch((e) => console.warn(`[zendesk:comment] ${e.message}`))
    }
    const notify = updated.contactEmail ?? auth.email
    if (notify) await sendEmail(store, { to: notify, ...ticketUpdatedEmail({ id: updated.id, subject: updated.title, status: updated.status }, message) }).catch(() => {})
    return send(res, 200, { item: updated })
  }

  const srOne = pathname.match(/^\/api\/service-requests\/([^/]+)$/)
  if (srOne && req.method === 'PATCH') {
    if (!can(auth, 'view_ticket_oversight')) return forbidden(res, 'Only internal staff can update request status.')
    const body = await readJson(req)
    const before = await store.getServiceRequestById(srOne[1])
    if (!before) return notFound(res, 'Request not found.')
    const updated = await store.update('service_requests', srOne[1], body.item ?? body)
    await audit(auth, 'service_request', srOne[1], 'update', { status: before.status, ownerTeam: before.ownerTeam }, { status: updated.status, ownerTeam: updated.ownerTeam })
    return send(res, 200, { item: updated })
  }

  if (pathname === '/api/service-requests/sync' && req.method === 'POST') {
    if (!can(auth, 'view_ticket_oversight')) return forbidden(res)
    return send(res, 200, await runZendeskSync())
  }

  /* ---- knowledge base ---- */
  if (pathname === '/api/knowledge/sync' && req.method === 'POST') {
    if (!can(auth, 'manage_knowledge')) return forbidden(res)
    return send(res, 200, await runNotionSync())
  }

  /* ---- users ---- */
  if (pathname === '/api/users' && req.method === 'POST') {
    const { user, password } = await readJson(req)
    if (!user?.email || !user?.fullName) return reply400(res, 'Name and email are required.')
    const targetCompany = user.companyId ?? auth.companyId
    if (!canManageUser(auth, targetCompany, user.role)) return forbidden(res, 'You cannot create a user with that role/company.')
    try {
      const created = await store.createUser(
        {
          id: uid('u'),
          company_id: targetCompany,
          site_id: user.siteId ?? null,
          full_name: user.fullName,
          email: String(user.email).toLowerCase(),
          user_type: user.userType ?? inferUserType(user.role),
          role: user.role,
          status: user.status ?? 'invited',
        },
        password,
      )
      await audit(auth, 'user', created.id, 'create', null, { email: created.email, role: created.role })
      return send(res, 201, { user: created })
    } catch (error) {
      return reply400(res, error.message)
    }
  }

  const userOne = pathname.match(/^\/api\/users\/([^/]+)$/)
  if (userOne && req.method === 'PATCH') {
    const target = await store.getOne('users', userOne[1])
    if (!target) return notFound(res, 'User not found.')
    const { touch, ...fields } = await readJson(req)
    const nextRole = fields.role ?? target.role
    if (!canManageUser(auth, target.companyId, nextRole)) return forbidden(res)
    const updated = await store.update('users', userOne[1], fields, { touch })
    await audit(auth, 'user', userOne[1], 'update', { role: target.role, status: target.status }, { role: updated.role, status: updated.status })
    return send(res, 200, { user: updated })
  }

  const userReset = pathname.match(/^\/api\/users\/([^/]+)\/reset-password$/)
  if (userReset && req.method === 'POST') {
    const target = await store.getOne('users', userReset[1])
    if (!target) return notFound(res, 'User not found.')
    if (!canManageUser(auth, target.companyId, target.role)) return forbidden(res)
    const { password } = await readJson(req)
    if (!password || String(password).length < 4) return reply400(res, 'Password must be at least 4 characters.')
    await store.setPassword(userReset[1], password)
    await audit(auth, 'user', userReset[1], 'reset_password', null, null)
    return send(res, 200, { ok: true })
  }

  /* ---- scoring model activation ---- */
  const activate = pathname.match(/^\/api\/scoring-models\/([^/]+)\/activate$/)
  if (activate && req.method === 'POST') {
    if (!can(auth, 'manage_scoring')) return forbidden(res)
    await store.list('scoring_models', { where: "status = 'active'", params: [] }).then((models) =>
      Promise.all(models.filter((m) => m.id !== activate[1]).map((m) => store.update('scoring_models', m.id, { status: 'archived' }, { touch: false }))),
    )
    const updated = await store.update('scoring_models', activate[1], { status: 'active' }, { touch: false })
    await audit(auth, 'scoring_model', activate[1], 'activate', null, { status: 'active' })
    return send(res, 200, { item: updated })
  }

  /* ---- announcements (create → notify + email by audience) ---- */
  if (pathname === '/api/announcements' && req.method === 'POST') {
    if (!can(auth, 'manage_announcements')) return forbidden(res)
    const { announcement } = await readJson(req)
    if (!announcement?.title || !announcement?.body) return reply400(res, 'Title and body are required.')
    const created = await store.insert('announcements', {
      id: uid('ann'),
      title: announcement.title,
      body: announcement.body,
      audience_type: announcement.audienceType ?? 'all',
      pinned: Boolean(announcement.pinned),
      created_by: auth.sub,
      publish_at: announcement.publishAt ?? nowIso(),
      expire_at: announcement.expireAt ?? null,
    })
    await audit(auth, 'announcement', created.id, 'create', null, { audience: created.audienceType })
    // notifyUsers returns the audience-matched users; reuse them for the email
    // broadcast (no second query, single audience rule) and send concurrently.
    const targets = await store.notifyUsers(created.audienceType, {
      refId: created.id,
      kind: 'announcement',
      title: created.title,
      body: created.body,
      link: '/app',
    })
    await Promise.all(
      targets.map((u) =>
        sendEmail(store, { to: u.email, ...announcementEmail({ title: created.title, body: created.body, author: auth.name }) }).catch(() => {}),
      ),
    )
    return send(res, 201, { item: created, recipients: targets.length })
  }
  const annOne = pathname.match(/^\/api\/announcements\/([^/]+)$/)
  if (annOne && (req.method === 'PATCH' || req.method === 'DELETE')) {
    if (!can(auth, 'manage_announcements')) return forbidden(res)
    if (req.method === 'DELETE') {
      await store.remove('announcements', annOne[1])
      await audit(auth, 'announcement', annOne[1], 'delete', null, null)
      return send(res, 200, { ok: true })
    }
    const updated = await store.update('announcements', annOne[1], (await readJson(req)).item ?? {})
    return send(res, 200, { item: updated })
  }

  /* ---- notifications ---- */
  const notifRead = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (notifRead && req.method === 'POST') {
    await store.update('notifications', notifRead[1], { read: true })
    return send(res, 200, { ok: true })
  }
  if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
    await store.markNotificationsRead(auth.sub)
    return send(res, 200, { ok: true })
  }

  /* ---- invoices PDF ---- */
  const invPdf = pathname.match(/^\/api\/invoices\/([^/]+)\/pdf$/)
  if (invPdf && req.method === 'GET') {
    const invoice = await store.getOne('invoices', invPdf[1])
    if (!invoice) return notFound(res, 'Invoice not found.')
    if (!isInternal(auth) && !canSeeCompany(auth, invoice.companyId)) return forbidden(res)
    const company = invoice.companyId ? await store.getOne('companies', invoice.companyId) : null
    const buffer = await invoicePdf(
      { ...invoice, lineItems: invoice.lineItemsJson },
      { company: company?.companyName, billingContact: company?.billingContactName, email: company?.billingContactEmail },
    )
    return sendBuffer(res, 200, buffer, 'application/pdf', `${invoice.id}.pdf`)
  }

  /* ---- ROI report PDF ---- */
  if (pathname === '/api/reports/calculation' && req.method === 'POST') {
    const { report } = await readJson(req)
    if (!report?.output) return reply400(res, 'Report payload is required.')
    const buffer = await reportPdf(report)
    return sendBuffer(res, 200, buffer, 'application/pdf', `${report.estimateId || 'estimate'}.pdf`)
  }

  /* ---- email outbox (internal) ---- */
  if (pathname === '/api/emails' && req.method === 'GET') {
    if (!isInternal(auth)) return forbidden(res)
    return send(res, 200, { emails: await store.getEmails(), mode: emailMode() })
  }

  /* ---- analytics (internal) ---- */
  if (pathname === '/api/analytics' && req.method === 'GET') {
    if (!can(auth, 'view_analytics')) return forbidden(res)
    return send(res, 200, await buildAnalytics())
  }

  /* ---- generic admin resources ---- */
  const resMatch = pathname.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?$/)
  if (resMatch && RESOURCES[resMatch[1]]) {
    const handled = await handleResource(req, res, auth, resMatch[1], resMatch[2])
    if (handled) return
  }

  return send(res, 404, { error: 'API route not found.' })
}

function inferUserType(role) {
  return roleMeta(role)?.userType ?? 'internal'
}

/* ----- analytics ----- */

async function buildAnalytics() {
  const [companies, requests, runs, users] = await Promise.all([
    store.list('companies', {}),
    store.list('service_requests', {}),
    store.list('calculator_runs', {}),
    store.list('users', {}),
  ])
  const byKey = (arr, key) => arr.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {})
  const partners = companies.filter((c) => c.companyType !== 'sigenic')
  const openRequests = requests.filter((r) => !['closed'].includes(r.status))
  const consultations = requests.filter((r) => r.requestType === 'consultation' || r.source === 'calculator_cta')
  const deptCounts = byKey(runs.filter((r) => r.departmentId), 'departmentId')
  return {
    counts: {
      companies: companies.length,
      partners: partners.length,
      activePartners: partners.filter((c) => c.status === 'active').length,
      prospects: partners.filter((c) => c.status === 'prospect').length,
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
      .map((c) => ({ id: c.id, name: c.companyName, type: c.companyType, requests: requests.filter((r) => r.companyId === c.id).length, runs: runs.filter((r) => r.companyId === c.id).length }))
      .sort((a, b) => b.requests + b.runs - (a.requests + a.runs))
      .slice(0, 8),
  }
}

/* ----- static SPA ----- */

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}
function serveStatic(res, pathname) {
  const dist = path.join(root, 'dist')
  const requested = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(dist, requested === '/' ? 'index.html' : requested)
  const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(dist, 'index.html')
  if (!fs.existsSync(target)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Build not found. Run `npm run build` before `npm start`.')
    return
  }
  res.writeHead(200, { 'Content-Type': contentType(target) })
  fs.createReadStream(target).pipe(res)
}

/* ----- boot ----- */

await store.init()
await initEmail()

if (zendeskEnabled()) {
  const interval = Number(process.env.ZENDESK_SYNC_INTERVAL_MS || 60000)
  scheduleLoop(runZendeskSync, interval, 'zendesk:sync')
  console.log(`[zendesk] two-way sync enabled (every ${interval}ms).`)
}

if (notionEnabled()) {
  const interval = Number(process.env.NOTION_SYNC_INTERVAL_MS || 300000)
  scheduleLoop(runNotionSync, interval, 'notion:sync')
  console.log(`[notion] knowledge-base sync enabled (every ${interval}ms).`)
}

const server = http.createServer((req, res) => {
  const pathname = routePath(req)
  if (pathname.startsWith('/api/')) {
    ;(async () => {
      if (await handlePublic(req, res, pathname)) return
      const auth = authUserFrom(req)
      if (!auth) return send(res, 401, { error: 'Authentication required.' })
      await handleApi(req, res, pathname, auth)
    })().catch((error) => {
      // A handler that already responded then threw must not crash the process:
      // log it (so the offending route is identifiable) and only respond if we still can.
      console.error(`[api] ${req.method} ${pathname} failed: ${error.stack || error.message}`)
      if (!res.headersSent && !res.writableEnded) send(res, 500, { error: error.message })
    })
    return
  }
  serveStatic(res, pathname)
})

server.listen(port, () => {
  console.log(`Sigenic Partner Portal API listening on http://localhost:${port}`)
})
