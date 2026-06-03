import { Router } from 'express'
import { zendeskEnabled } from '../integration/zendesk'
import { notionEnabled, getNotionImageUrl } from '../integration/notion'
import { emailMode } from '../infra/email'
import * as authService from '../services/auth.service'
import * as calculatorService from '../services/calculator.service'
import * as requestService from '../services/serviceRequest.service'
import * as publicService from '../services/public.service'
import * as attachmentService from '../services/attachment.service'
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
  // Notion-hosted article images: their upstream URLs are short-lived signed links,
  // so article bodies reference this stable proxy. We resolve a fresh URL per
  // request (cached server-side) and relay the bytes with a browser-cache hint.
  r.get('/notion/image/:blockId', async (req, res) => {
    const url = await getNotionImageUrl(req.params.blockId)
    if (!url) return res.status(404).end()
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).end()
    const buf = Buffer.from(await upstream.arrayBuffer())
    res
      .set({
        'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      })
      .send(buf)
  })
  // Article body attachments: images shown inline, other files downloaded. Public
  // like the Notion image proxy — <img>/download requests can't carry an auth token,
  // and asset ids are unguessable. Content is immutable per id, so cache hard.
  r.get('/attachments/:id', async (req, res) => {
    const asset = await attachmentService.getAttachment(store, req.params.id)
    const inline = asset.mimeType.startsWith('image/')
    res
      .set({
        'Content-Type': asset.mimeType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asset.filename.replace(/"/g, '')}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
      .send(asset.data)
  })
  r.post('/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {}
    res.json(await authService.login(store, email, password))
  })
  r.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body ?? {}
    // Prefer a configured canonical URL; fall back to the request's own origin (dev-friendly).
    const appUrl = process.env.APP_BASE_URL || (req.headers.origin as string) || ''
    await authService.requestPasswordReset(store, email, appUrl)
    res.json({ ok: true }) // always ok — never reveal whether the email exists
  })
  r.post('/auth/reset-password', async (req, res) => {
    const { token, password } = req.body ?? {}
    await authService.resetPasswordWithToken(store, token, password)
    res.json({ ok: true })
  })
  r.post('/public/requests', async (req, res) => {
    res.status(201).json({ item: await requestService.createPublicLead(store, req.body?.request) })
  })
  r.post('/public/calculate', async (req, res) => {
    res.json(await calculatorService.publicCalculate(store, req.body?.selection))
  })

  return r
}
