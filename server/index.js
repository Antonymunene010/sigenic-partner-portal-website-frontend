import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStore } from './db/store'
import { bearerToken, verifyToken } from './infra/auth'
import { initEmail, emailMode } from './infra/email'
import { zendeskEnabled } from './integration/zendesk'
import { notionEnabled } from './integration/notion'
import { isInternal } from '../shared/permissions'
import { HttpError, forbidden } from './http/errors'
import * as authService from './services/auth.service'
import * as hydrateService from './services/hydrate.service'
import * as calculatorService from './services/calculator.service'
import * as requestService from './services/serviceRequest.service'
import * as announcementService from './services/announcement.service'
import * as userService from './services/user.service'
import * as adminService from './services/admin.service'
import * as knowledgeService from './services/knowledge.service'
import * as notificationService from './services/notification.service'
import * as pdfService from './services/pdf.service'
import * as resourceService from './services/resource.service'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
loadEnvFile(path.join(root, '.env'))

const port = Number(process.env.PORT ?? 8787)
const store = createStore()

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 5_000_000) {
        reject(new HttpError(413, 'Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new HttpError(400, 'Invalid JSON payload'))
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

/**
 * Run `fn` on a fixed interval with NO overlapping cycles: the next run is
 * armed only after the current one settles, so a slow sync can't stack up.
 * Fires once immediately.
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
    send(res, 200, await authService.login(store, email, password))
    return true
  }
  if (pathname === '/api/public/requests' && req.method === 'POST') {
    const { request } = await readJson(req)
    send(res, 201, { item: await requestService.createPublicLead(store, request) })
    return true
  }
  if (pathname === '/api/public/calculate' && req.method === 'POST') {
    const { selection } = await readJson(req)
    send(res, 200, await calculatorService.publicCalculate(store, selection))
    return true
  }
  return false
}

/* ----- authenticated routes ----- */

async function handleApi(req, res, pathname, auth) {
  if (pathname === '/api/hydrate' && req.method === 'GET') return send(res, 200, await hydrateService.hydrate(store, auth))
  if (pathname === '/api/auth/me' && req.method === 'GET') return send(res, 200, { user: await authService.getMe(store, auth) })
  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    const { currentPassword, newPassword } = await readJson(req)
    await authService.changePassword(store, auth, currentPassword, newPassword)
    return send(res, 200, { ok: true })
  }

  /* ---- calculator ---- */
  if (pathname === '/api/calculate' && req.method === 'POST') {
    return send(res, 200, await calculatorService.calculate(store, auth, await readJson(req)))
  }

  /* ---- service requests ---- */
  if (pathname === '/api/service-requests' && req.method === 'POST') {
    const { request } = await readJson(req)
    return send(res, 201, { item: await requestService.createServiceRequest(store, auth, request) })
  }
  const srMsg = pathname.match(/^\/api\/service-requests\/([^/]+)\/messages$/)
  if (srMsg && req.method === 'POST') {
    const { body } = await readJson(req)
    return send(res, 200, { item: await requestService.addServiceRequestMessage(store, auth, srMsg[1], body) })
  }
  if (pathname === '/api/service-requests/sync' && req.method === 'POST') {
    return send(res, 200, await requestService.triggerZendeskSync(store, auth))
  }
  const srOne = pathname.match(/^\/api\/service-requests\/([^/]+)$/)
  if (srOne && req.method === 'PATCH') {
    const body = await readJson(req)
    return send(res, 200, { item: await requestService.updateServiceRequest(store, auth, srOne[1], body.item ?? body) })
  }

  /* ---- knowledge base ---- */
  if (pathname === '/api/knowledge/sync' && req.method === 'POST') {
    return send(res, 200, await knowledgeService.triggerNotionSync(store, auth))
  }

  /* ---- users ---- */
  if (pathname === '/api/users' && req.method === 'POST') {
    const { user, password } = await readJson(req)
    return send(res, 201, { user: await userService.createUser(store, auth, user, password) })
  }
  const userReset = pathname.match(/^\/api\/users\/([^/]+)\/reset-password$/)
  if (userReset && req.method === 'POST') {
    const { password } = await readJson(req)
    await userService.resetUserPassword(store, auth, userReset[1], password)
    return send(res, 200, { ok: true })
  }
  const userOne = pathname.match(/^\/api\/users\/([^/]+)$/)
  if (userOne && req.method === 'PATCH') {
    return send(res, 200, { user: await userService.updateUser(store, auth, userOne[1], await readJson(req)) })
  }

  /* ---- scoring model activation (before the generic resource route) ---- */
  const activate = pathname.match(/^\/api\/scoring-models\/([^/]+)\/activate$/)
  if (activate && req.method === 'POST') {
    return send(res, 200, { item: await adminService.activateScoringModel(store, auth, activate[1]) })
  }

  /* ---- announcements (create → notify + email broadcast) ---- */
  if (pathname === '/api/announcements' && req.method === 'POST') {
    const { announcement } = await readJson(req)
    return send(res, 201, await announcementService.createAnnouncement(store, auth, announcement))
  }
  const annOne = pathname.match(/^\/api\/announcements\/([^/]+)$/)
  if (annOne && (req.method === 'PATCH' || req.method === 'DELETE')) {
    if (req.method === 'DELETE') {
      await announcementService.deleteAnnouncement(store, auth, annOne[1])
      return send(res, 200, { ok: true })
    }
    return send(res, 200, { item: await announcementService.updateAnnouncement(store, auth, annOne[1], (await readJson(req)).item) })
  }

  /* ---- notifications ---- */
  const notifRead = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (notifRead && req.method === 'POST') {
    await notificationService.markNotificationRead(store, notifRead[1])
    return send(res, 200, { ok: true })
  }
  if (pathname === '/api/notifications/read-all' && req.method === 'POST') {
    await notificationService.markAllNotificationsRead(store, auth.sub)
    return send(res, 200, { ok: true })
  }

  /* ---- PDFs ---- */
  const invPdf = pathname.match(/^\/api\/invoices\/([^/]+)\/pdf$/)
  if (invPdf && req.method === 'GET') {
    const buffer = await pdfService.getInvoicePdf(store, auth, invPdf[1])
    return sendBuffer(res, 200, buffer, 'application/pdf', `${invPdf[1]}.pdf`)
  }
  if (pathname === '/api/reports/calculation' && req.method === 'POST') {
    const { report } = await readJson(req)
    const buffer = await pdfService.generateReportPdf(report)
    return sendBuffer(res, 200, buffer, 'application/pdf', `${report?.estimateId || 'estimate'}.pdf`)
  }

  /* ---- email outbox + analytics (internal) ---- */
  if (pathname === '/api/emails' && req.method === 'GET') {
    if (!isInternal(auth)) throw forbidden()
    return send(res, 200, { emails: await store.getEmails(), mode: emailMode() })
  }
  if (pathname === '/api/analytics' && req.method === 'GET') {
    return send(res, 200, await adminService.buildAnalytics(store, auth))
  }

  /* ---- generic admin resources (must come last) ---- */
  const resMatch = pathname.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?$/)
  if (resMatch && resourceService.isResource(resMatch[1])) {
    const resource = resMatch[1]
    const id = resMatch[2]
    if (!id && req.method === 'GET') return send(res, 200, await resourceService.listResource(store, auth, resource))
    if (!id && req.method === 'POST') return send(res, 201, { item: await resourceService.createResource(store, auth, resource, await readJson(req)) })
    if (id && req.method === 'PATCH') return send(res, 200, { item: await resourceService.updateResource(store, auth, resource, id, await readJson(req)) })
    if (id && req.method === 'DELETE') return send(res, 200, await resourceService.deleteResource(store, auth, resource, id))
  }

  return send(res, 404, { error: 'API route not found.' })
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
  scheduleLoop(() => requestService.runZendeskSync(store), interval, 'zendesk:sync')
  console.log(`[zendesk] two-way sync enabled (every ${interval}ms).`)
}

if (notionEnabled()) {
  const interval = Number(process.env.NOTION_SYNC_INTERVAL_MS || 300000)
  scheduleLoop(() => knowledgeService.syncNotionArticles(store), interval, 'notion:sync')
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
      const status = error instanceof HttpError ? error.status : 500
      if (!res.headersSent && !res.writableEnded) send(res, status, { error: error.message })
    })
    return
  }
  serveStatic(res, pathname)
})

server.listen(port, () => {
  console.log(`Sigenic Partner Portal API listening on http://localhost:${port}`)
})
