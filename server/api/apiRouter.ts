import express, { Router } from 'express'
import { isInternal } from '../../shared/permissions'
import { forbidden } from '../http/errors'
import { emailMode } from '../infra/email'
import * as authService from '../services/auth.service'
import * as hydrateService from '../services/hydrate.service'
import * as calculatorService from '../services/calculator.service'
import * as requestService from '../services/serviceRequest.service'
import * as announcementService from '../services/announcement.service'
import * as userService from '../services/user.service'
import * as signupService from '../services/signup.service'
import * as adminService from '../services/admin.service'
import * as knowledgeService from '../services/knowledge.service'
import * as attachmentService from '../services/attachment.service'
import * as notificationService from '../services/notification.service'
import * as pdfService from '../services/pdf.service'
import * as resourceService from '../services/resource.service'
import * as emailTemplateService from '../services/emailTemplate.service'
import type { Store } from '../db/store'

/**
 * Authenticated routes. Specific paths are registered before the generic
 * `/:resource` routes (which guard with isResource and next() through), matching
 * the original dispatch order so bespoke endpoints win over generic CRUD.
 */
export function apiRouter(store: Store): Router {
  const r = Router()

  r.get('/hydrate', async (req, res) => {
    res.json(await hydrateService.hydrate(store, req.auth!))
  })
  r.get('/auth/me', async (req, res) => {
    res.json({ user: await authService.getMe(store, req.auth!) })
  })
  r.post('/auth/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {}
    await authService.changePassword(store, req.auth!, currentPassword, newPassword)
    res.json({ ok: true })
  })

  /* calculator */
  r.post('/calculate', async (req, res) => {
    res.json(await calculatorService.calculate(store, req.auth!, req.body ?? {}))
  })
  // Final wizard step — persists the run as a lead + emails internal admins. Distinct
  // from /calculate so the intermediate "Statistical Analysis" step on the wizard
  // stays stateless and doesn't litter the admin dashboard with abandoned previews.
  r.post('/calculator/submit', async (req, res) => {
    res.status(201).json(await calculatorService.submit(store, req.auth!, req.body ?? {}))
  })

  /* service requests */
  r.post('/service-requests', async (req, res) => {
    res.status(201).json({ item: await requestService.createServiceRequest(store, req.auth!, req.body?.request) })
  })
  r.post('/service-requests/:id/messages', async (req, res) => {
    res.json({ item: await requestService.addServiceRequestMessage(store, req.auth!, req.params.id, req.body?.body) })
  })
  r.post('/service-requests/sync', async (req, res) => {
    res.json(await requestService.triggerZendeskSync(store, req.auth!))
  })
  r.patch('/service-requests/:id', async (req, res) => {
    const body = req.body ?? {}
    res.json({ item: await requestService.updateServiceRequest(store, req.auth!, req.params.id, body.item ?? body) })
  })

  /* knowledge base */
  r.post('/knowledge/sync', async (req, res) => {
    res.json(await knowledgeService.triggerNotionSync(store, req.auth!))
  })

  /* article assets: raw binary upload (images/files embedded into article bodies) */
  r.post('/attachments', express.raw({ type: () => true, limit: '25mb' }), async (req, res) => {
    const filename = typeof req.query.filename === 'string' ? req.query.filename : 'upload'
    const mimeType = req.get('content-type') || 'application/octet-stream'
    const asset = await attachmentService.createAttachment(store, req.auth!, req.body as Buffer, { filename, mimeType })
    res.status(201).json(asset)
  })

  /* users */
  r.post('/users', async (req, res) => {
    const { user, password } = req.body ?? {}
    res.status(201).json({ user: await userService.createUser(store, req.auth!, user, password, req.headers.origin as string | undefined) })
  })
  r.post('/users/:id/reset-password', async (req, res) => {
    await userService.resetUserPassword(store, req.auth!, req.params.id, req.headers.origin as string | undefined)
    res.json({ ok: true })
  })
  r.post('/users/:id/resend-invite', async (req, res) => {
    await userService.resendInvite(store, req.auth!, req.params.id, req.headers.origin as string | undefined)
    res.json({ ok: true })
  })
  // Self-service sign-up review (client feedback 2026-06). Approve flips the pending
  // user to `invited` and emails them the set-password link (the normal invite path);
  // reject flips them to `rejected`. Both re-check approval scope in the service.
  r.post('/users/:id/approve', async (req, res) => {
    res.json({
      user: await signupService.approveSignup(store, req.auth!, req.params.id, {
        role: req.body?.role,
        origin: req.headers.origin as string | undefined,
      }),
    })
  })
  r.post('/users/:id/reject', async (req, res) => {
    res.json(await signupService.rejectSignup(store, req.auth!, req.params.id, req.body?.reason))
  })
  r.patch('/users/:id', async (req, res) => {
    res.json({ user: await userService.updateUser(store, req.auth!, req.params.id, req.body ?? {}) })
  })
  r.delete('/users/:id', async (req, res) => {
    res.json(await userService.deleteUser(store, req.auth!, req.params.id))
  })

  /* scoring model activation (before the generic /:resource route) */
  r.post('/scoring-models/:id/activate', async (req, res) => {
    res.json({ item: await adminService.activateScoringModel(store, req.auth!, req.params.id) })
  })

  /* announcements */
  r.post('/announcements', async (req, res) => {
    res.status(201).json(await announcementService.createAnnouncement(store, req.auth!, req.body?.announcement))
  })
  r.patch('/announcements/:id', async (req, res) => {
    res.json({ item: await announcementService.updateAnnouncement(store, req.auth!, req.params.id, req.body?.item) })
  })
  r.delete('/announcements/:id', async (req, res) => {
    await announcementService.deleteAnnouncement(store, req.auth!, req.params.id)
    res.json({ ok: true })
  })

  /* notifications */
  r.post('/notifications/:id/read', async (req, res) => {
    await notificationService.markNotificationRead(store, req.auth!, req.params.id)
    res.json({ ok: true })
  })
  r.post('/notifications/read-all', async (req, res) => {
    await notificationService.markAllNotificationsRead(store, req.auth!.sub)
    res.json({ ok: true })
  })

  /* PDFs */
  r.get('/invoices/:id/pdf', async (req, res) => {
    const buffer = await pdfService.getInvoicePdf(store, req.auth!, req.params.id)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${req.params.id}.pdf"` }).send(buffer)
  })
  r.post('/reports/calculation', async (req, res) => {
    const report = req.body?.report
    const buffer = await pdfService.generateReportPdf(report)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${report?.estimateId || 'estimate'}.pdf"` }).send(buffer)
  })

  /* email templates (super_admin-only editor) — registered before the generic
     /:resource handlers so PATCH/POST on a slug doesn't fall through to the
     resource dispatcher. */
  r.get('/email-templates', async (req, res) => {
    res.json(await emailTemplateService.listEmailTemplates(store, req.auth!))
  })
  r.get('/email-templates/:slug', async (req, res) => {
    res.json(await emailTemplateService.getEmailTemplate(store, req.auth!, req.params.slug))
  })
  r.patch('/email-templates/:slug', async (req, res) => {
    res.json(await emailTemplateService.updateEmailTemplate(store, req.auth!, req.params.slug, req.body ?? {}))
  })
  r.post('/email-templates/:slug/reset', async (req, res) => {
    res.json(await emailTemplateService.resetEmailTemplate(store, req.auth!, req.params.slug))
  })

  /* internal: email outbox + analytics */
  r.get('/emails', async (req, res) => {
    if (!isInternal(req.auth!)) throw forbidden()
    res.json({ emails: await store.getEmails(), mode: emailMode() })
  })
  r.get('/analytics', async (req, res) => {
    res.json(await adminService.buildAnalytics(store, req.auth!))
  })

  /* generic admin resources — registered last; isResource guards then next() */
  r.get('/:resource', async (req, res, next) => {
    if (!resourceService.isResource(req.params.resource)) return next()
    res.json(await resourceService.listResource(store, req.auth!, req.params.resource))
  })
  r.post('/:resource', async (req, res, next) => {
    if (!resourceService.isResource(req.params.resource)) return next()
    res.status(201).json({ item: await resourceService.createResource(store, req.auth!, req.params.resource, req.body ?? {}) })
  })
  r.patch('/:resource/:id', async (req, res, next) => {
    if (!resourceService.isResource(req.params.resource)) return next()
    res.json({ item: await resourceService.updateResource(store, req.auth!, req.params.resource, req.params.id, req.body ?? {}) })
  })
  r.delete('/:resource/:id', async (req, res, next) => {
    if (!resourceService.isResource(req.params.resource)) return next()
    res.json(await resourceService.deleteResource(store, req.auth!, req.params.resource, req.params.id))
  })

  return r
}
