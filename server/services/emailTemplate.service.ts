import { can } from '../../shared/permissions'
import type { EmailTemplateDef, EmailTemplateView } from '../../shared/emailTemplate'
import { EMAIL_DEFAULTS } from '../infra/email'
import { badRequest, forbidden, notFound } from '../http/errors'
import { audit } from './audit'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

export type { EmailTemplateView }

function requireManage(auth: AuthPayload): void {
  if (!can(auth, 'manage_email_templates')) {
    throw forbidden('Only super admins can edit email templates.')
  }
}

function project(def: EmailTemplateDef, override: any | null): EmailTemplateView {
  return {
    slug: def.slug,
    name: def.name,
    description: def.description,
    variables: def.variables,
    defaultSubject: def.subject,
    defaultBody: def.body,
    subject: override?.subject ?? def.subject,
    body: override?.body ?? def.body,
    customized: !!override,
    updatedBy: override?.updatedBy ?? null,
    updatedAt: override?.updatedAt ?? null,
  }
}

/** Full catalog, in EMAIL_DEFAULTS declaration order (which doubles as the
 *  editor's display order — adding a new template in email.ts is the only
 *  registration step). */
export async function listEmailTemplates(
  store: Store,
  auth: AuthPayload,
): Promise<{ templates: EmailTemplateView[] }> {
  requireManage(auth)
  const overrides = await store.listEmailTemplates()
  const overrideMap = new Map<string, any>(overrides.map((o: any) => [o.slug, o]))
  const templates = Object.values(EMAIL_DEFAULTS).map((def) =>
    project(def, overrideMap.get(def.slug) ?? null),
  )
  return { templates }
}

export async function getEmailTemplate(
  store: Store,
  auth: AuthPayload,
  slug: string,
): Promise<{ item: EmailTemplateView }> {
  requireManage(auth)
  const def = EMAIL_DEFAULTS[slug]
  if (!def) throw notFound('Unknown email template.')
  const override = await store.getEmailTemplate(slug)
  return { item: project(def, override) }
}

export async function updateEmailTemplate(
  store: Store,
  auth: AuthPayload,
  slug: string,
  patch: { subject?: unknown; body?: unknown },
): Promise<{ item: EmailTemplateView }> {
  requireManage(auth)
  const def = EMAIL_DEFAULTS[slug]
  if (!def) throw notFound('Unknown email template.')
  const subject = typeof patch.subject === 'string' ? patch.subject.trim() : ''
  const body = typeof patch.body === 'string' ? patch.body : ''
  if (!subject) throw badRequest('Subject is required.')
  if (!body.trim()) throw badRequest('Body is required.')
  const before = await store.getEmailTemplate(slug)
  const saved = await store.upsertEmailTemplate(slug, subject, body, auth.sub)
  await audit(
    store,
    auth,
    'email_template',
    slug,
    before ? 'update' : 'create',
    before ? { subject: before.subject, body: before.body } : null,
    { subject: saved.subject, body: saved.body },
  )
  return { item: project(def, saved) }
}

/** "Reset to default" = drop the override row; renders fall back to EMAIL_DEFAULTS. */
export async function resetEmailTemplate(
  store: Store,
  auth: AuthPayload,
  slug: string,
): Promise<{ item: EmailTemplateView }> {
  requireManage(auth)
  const def = EMAIL_DEFAULTS[slug]
  if (!def) throw notFound('Unknown email template.')
  const before = await store.getEmailTemplate(slug)
  if (before) {
    await store.removeEmailTemplate(slug)
    await audit(
      store,
      auth,
      'email_template',
      slug,
      'reset',
      { subject: before.subject, body: before.body },
      null,
    )
  }
  return { item: project(def, null) }
}
