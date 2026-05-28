import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowedResources, createStore } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

loadEnvFile(path.join(root, '.env'))

const port = Number(process.env.PORT ?? 8787)

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

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
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key && process.env[key] == null) process.env[key] = value
  }
}

function calculate(cfg, sel) {
  const machine = cfg.machines.find((item) => item.id === sel.machineId)
  if (!machine) throw new Error('Machine not found')
  const processes = sel.processIds
    .map((id) => cfg.processes.find((item) => item.id === id))
    .filter(Boolean)
  const { costPerWafer, volumePerMonth, costOfExcursion } = sel.business
  const { yieldPct, scrapRate, downtimePct } = sel.operational
  const aggregateOpt = processes.reduce((acc, item) => acc + item.optimizationFactor * (1 - acc), 0)
  let paramBoost = 0
  for (const param of machine.params) {
    const val = sel.params[param.key] ?? param.default
    const norm = 1 - (val - param.min) / (param.max - param.min)
    paramBoost += Math.max(-0.03, Math.min(0.04, (norm - 0.5) * 0.08))
  }
  paramBoost = Math.max(-0.05, Math.min(0.08, paramBoost))
  const effectiveOpt = Math.max(0, Math.min(0.6, aggregateOpt + paramBoost))
  const damp = (total) => total * (1 - Math.min(0.3, total * 0.02))
  const yieldImprovementPct = damp(processes.reduce((sum, item) => sum + item.yieldUpliftPct, 0))
  const rawScrapReduction = damp(processes.reduce((sum, item) => sum + item.scrapReductionPct, 0))
  const scrapReductionPct = Math.min(rawScrapReduction, scrapRate * 0.7)
  const downtimeReductionPct = damp(processes.reduce((sum, item) => sum + item.downtimeReductionPct, 0))
  const baselineMonthlySpend = costPerWafer * volumePerMonth
  const directCostSavings = baselineMonthlySpend * effectiveOpt * 0.35
  const scrapSavings = (scrapReductionPct / 100) * baselineMonthlySpend * 0.45
  const monthlyExcursionBase = costOfExcursion / 6
  const excursionAvoidance = monthlyExcursionBase * Math.min(0.9, scrapReductionPct / 10)
  const yieldRevenue = (yieldImprovementPct / 100) * volumePerMonth * cfg.globals.waferRevenue * 0.25
  const grossMonthly = directCostSavings + scrapSavings + excursionAvoidance + yieldRevenue
  const fee = grossMonthly * cfg.globals.serviceFeePct
  const monthlySavings = grossMonthly - fee
  const annualSavings = monthlySavings * 12
  const fasterDetectionHrs = Math.round(downtimeReductionPct * 6 + scrapReductionPct * 0.8)
  const manualEffortReductionHrs = Math.round(processes.length * 18 + effectiveOpt * 40)
  const engagementCost = fee * 2 + 35000
  const paybackMonths = monthlySavings > 0 ? engagementCost / monthlySavings : 99
  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        effectiveOpt * 140 +
          yieldImprovementPct * 3 +
          scrapReductionPct * 2 +
          downtimeReductionPct * 2 +
          (yieldPct < 85 ? 8 : 0) +
          (scrapRate > 3 ? 5 : 0) +
          (downtimePct > 6 ? 6 : 0) -
          (paybackMonths > 12 ? 10 : 0),
      ),
    ),
  )
  return {
    input: sel,
    yieldImprovementPct,
    scrapReductionPct,
    downtimeReductionPct,
    monthlySavings,
    annualSavings,
    fasterDetectionHrs,
    manualEffortReductionHrs,
    paybackMonths,
    score,
    breakdown: [
      { label: 'Direct process cost reduction', value: directCostSavings },
      { label: 'Scrap avoidance', value: scrapSavings },
      { label: 'Excursion avoidance', value: excursionAvoidance },
      { label: 'Incremental yield revenue', value: yieldRevenue },
      { label: 'Sigenic service fee', value: -fee },
    ],
  }
}

async function createZendeskTicket(ticket) {
  const subdomain = process.env.ZENDESK_SUBDOMAIN
  const email = process.env.ZENDESK_EMAIL
  const token = process.env.ZENDESK_API_TOKEN
  if (!subdomain || !email || !token) {
    return { mode: 'mock', skipped: true }
  }
  const body = ticket.messages?.find((message) => message.authorRole === 'you')?.body ?? ticket.subject
  const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/tickets.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}/token:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ticket: {
        subject: ticket.subject,
        comment: { body },
        priority: ticket.priority === 'normal' ? undefined : ticket.priority,
        tags: ['partner_portal', ...(ticket.tags ?? [])],
      },
    }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? 'Zendesk ticket creation failed')
  return { mode: 'zendesk', id: payload.ticket?.id }
}

async function handleApi(req, res, pathname, store) {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (pathname === '/api/health' && req.method === 'GET') {
    return send(res, 200, {
      ok: true,
      database: await store.health(),
      zendesk: Boolean(process.env.ZENDESK_API_TOKEN),
    })
  }
  if (pathname === '/api/bootstrap' && req.method === 'POST') {
    const body = await readJson(req)
    return send(res, 200, await store.bootstrap(body.resources ?? {}))
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await readJson(req)
    if (!email || !password) return send(res, 400, { error: 'Email and password are required.' })
    const user = await store.getUserByEmail(String(email))
    if (!user) return send(res, 404, { error: 'No account found for that email.' })
    if (!user.active) return send(res, 403, { error: 'This account is deactivated.' })
    return send(res, 200, { user })
  }
  if (pathname === '/api/tickets' && req.method === 'POST') {
    const { ticket } = await readJson(req)
    if (!ticket?.id || !ticket?.subject) return send(res, 400, { error: 'Ticket id and subject are required.' })
    const zendesk = await createZendeskTicket(ticket)
    await store.upsertTicket(ticket, zendesk.id ? String(zendesk.id) : null)
    return send(res, 201, { ticket, zendesk })
  }
  if (pathname === '/api/calculate' && req.method === 'POST') {
    const { cfg, input } = await readJson(req)
    return send(res, 200, { result: calculate(cfg, input) })
  }
  const resourceMatch = pathname.match(/^\/api\/resources\/([^/]+)$/)
  if (resourceMatch) {
    const key = decodeURIComponent(resourceMatch[1])
    if (!allowedResources.has(key)) return send(res, 404, { error: 'Unknown resource.' })
    if (req.method === 'GET') return send(res, 200, { value: await store.getResource(key) })
    if (req.method === 'PUT') {
      const { value } = await readJson(req)
      return send(res, 200, { value: await store.putResource(key, value) })
    }
  }
  return send(res, 404, { error: 'API route not found.' })
}

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

const store = createStore()

await store.init()

const server = http.createServer((req, res) => {
  const pathname = routePath(req)
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, store).catch((error) => send(res, 500, { error: error.message }))
    return
  }
  serveStatic(res, pathname)
})

server.listen(port, () => {
  console.log(`Partner portal API listening on http://localhost:${port}`)
})
