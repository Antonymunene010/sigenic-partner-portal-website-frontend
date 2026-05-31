import { Router } from 'express'
import { zendeskEnabled } from '../integration/zendesk'
import { notionEnabled } from '../integration/notion'
import { emailMode } from '../infra/email'
import * as authService from '../services/auth.service'
import * as calculatorService from '../services/calculator.service'
import * as requestService from '../services/serviceRequest.service'
import * as publicService from '../services/public.service'
import type { Store } from '../db/store'

/** Unauthenticated routes (mounted at /api, before the authenticate middleware). */
export function publicRouter(store: Store): Router {
  const r = Router()

  r.get('/health', async (_req, res) => {
    res.json({ ok: true, database: await store.health(), zendesk: zendeskEnabled(), notion: notionEnabled(), email: emailMode() })
  })
  r.get('/public', async (_req, res) => {
    res.json(await publicService.publicBundle(store))
  })
  r.post('/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    res.json(await authService.login(store, email, password))
  })
  r.post('/public/requests', async (req, res) => {
    res.status(201).json({ item: await requestService.createPublicLead(store, req.body?.request) })
  })
  r.post('/public/calculate', async (req, res) => {
    res.json(await calculatorService.publicCalculate(store, req.body?.selection))
  })

  return r
}
