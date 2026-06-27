import { uid, nowIso } from '../util/ids'
import { INTERNAL_MANAGE } from '../../shared/permissions'
import { RISK_TIER_LABEL } from '../../shared/calc'
import {
  renderString,
  tidyBlankLines,
  type EmailTemplateDef,
  type EmailTemplateVar,
} from '../../shared/emailTemplate'
import type { CalcAdditionalInfo, RiskResult } from '../../shared/types'

// EmailTemplateDef/EmailTemplateVar live in shared/ so the admin editor preview
// renders strings the exact same way the server does at send-time. Re-exported
// here so existing imports from this module keep working.
export type { EmailTemplateDef, EmailTemplateVar }

/** A persisted outbox record — every send (real or mocked) is recorded for audit. */
export interface EmailRecord {
  id: string
  to: string
  subject: string
  text?: string
  mode: string
  delivered: boolean
  createdAt: string
  error?: string
  note?: string
}

interface EmailOutbox {
  appendEmail: (record: EmailRecord) => Promise<unknown>
}

/** Narrow store interface used by the rendering layer below. Optional so unit-test
 *  stubs and any caller that doesn't care about super-admin overrides can pass a
 *  minimal store and still get a rendered default. */
interface TemplateStore {
  getEmailTemplate?: (slug: string) => Promise<{ subject: string; body: string } | null>
}

/** Narrow store interface for the cross-service admin fanout helper below. */
interface AdminFanoutStore extends EmailOutbox {
  list: (table: string, opts?: { where?: string; params?: unknown[] }) => Promise<any[]>
}

interface EmailMessage {
  to: string
  subject: string
  text?: string
  html?: string
}

/**
 * Which "voice" sends the email. Per client (2026-06-27):
 *  - `default` → transactional account-management mail (invites, password
 *    resets, signup, announcements, tickets). Customer wants the `noreply@`
 *    mailbox so replies don't land in a sales inbox.
 *  - `sales` → ROI / risk calculator lead notifications & receipts. Customer
 *    routes these to `sigenic_sales@` so the sales team can follow up directly.
 *
 * Every call site that should NOT come from the default mailbox passes
 * `{ from: 'sales' }`. New categories should be added here, not at call sites.
 */
export type EmailFromCategory = 'default' | 'sales'

type EmailMode = 'outbox' | 'smtp'
type Sender = (msg: EmailMessage) => Promise<void>

const senders: Partial<Record<EmailFromCategory, Sender>> = {}
let mode: EmailMode = 'outbox'

const FROM_DEFAULT = process.env.EMAIL_FROM || 'Sigenic Partner Portal <noreply@sigenic.com>'
// Falls back to the default address so a single-mailbox deployment keeps
// working — only set EMAIL_FROM_SALES if the sales mailbox is actually
// configured (and ideally has its own SMTP credentials, see SMTP_USER_SALES).
const FROM_SALES = process.env.EMAIL_FROM_SALES || FROM_DEFAULT

function buildSender(
  nodemailer: typeof import('nodemailer'),
  cfg: { host: string; port: number; secure: boolean; user?: string; pass?: string },
  from: string,
): Sender {
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    // Gmail app passwords are often pasted with spaces — strip to match the
    // smtp-check probe so a credential that verifies offline also works here.
    auth: cfg.user ? { user: cfg.user, pass: (cfg.pass || '').replace(/\s+/g, '') } : undefined,
    // Hostinger's outbound SMTP path has been observed hanging for tens of
    // seconds when the relay doesn't respond. nodemailer's defaults are very
    // generous (~10min greeting timeout), which would freeze the request
    // handler that triggered the send. Cap the three phases tightly so a
    // wedged relay surfaces as a failed send within a few seconds, not a
    // wedged HTTP response.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return ({ to, subject, text, html }) =>
    transporter.sendMail({ from, to, subject, text, html: html || undefined })
}

/**
 * Initialise email transport. Priority:
 *  1. SMTP_HOST set → nodemailer over SMTP (local mailpit, Gmail relay, etc).
 *  2. Otherwise → outbox-only mode, every send is recorded but not delivered.
 *
 * A dedicated sales transport is only built when sales mail would otherwise
 * be indistinguishable from default — either it has its own credentials
 * (SMTP_USER_SALES + SMTP_PASS_SALES, required on standard smtp.gmail.com
 * which rewrites From: to the authenticated user) or it has a distinct
 * From: header (relays that allow arbitrary senders). When sales matches
 * default in both respects, sendEmail falls back to the default sender.
 */
export async function initEmail(): Promise<EmailMode> {
  const host = process.env.SMTP_HOST
  if (!host) {
    console.warn('[email] SMTP_HOST unset — emails will be recorded to the outbox instead of sent.')
    return mode
  }
  const baseCfg = {
    host,
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
  try {
    const nodemailer = await import('nodemailer')
    senders.default = buildSender(nodemailer, baseCfg, FROM_DEFAULT)
    const salesUser = process.env.SMTP_USER_SALES
    const salesPass = process.env.SMTP_PASS_SALES
    if (salesUser && salesPass && salesUser !== baseCfg.user) {
      senders.sales = buildSender(nodemailer, { ...baseCfg, user: salesUser, pass: salesPass }, FROM_SALES)
      console.log(`[email] sales SMTP transport ready (user=${salesUser}).`)
    } else if (FROM_SALES !== FROM_DEFAULT) {
      senders.sales = buildSender(nodemailer, baseCfg, FROM_SALES)
      console.log(
        `[email] sales mail reuses default SMTP credentials (no SMTP_USER_SALES set); From: will be "${FROM_SALES}" — ensure your relay allows that sender.`,
      )
    }
    mode = 'smtp'
    console.log(`[email] SMTP transport ready (${host}:${baseCfg.port}).`)
  } catch (error: any) {
    console.warn(`[email] Failed to init SMTP (${error.message}) — falling back to outbox.`)
  }
  return mode
}

export function emailMode(): EmailMode {
  return mode
}

/**
 * Send (or record) an email and persist a copy to the store-backed outbox so
 * admins can verify delivery even without a real mailbox.
 *
 * `opts.from` picks the From: identity — defaults to `default` (the noreply
 * mailbox). Pass `'sales'` for calculator lead / receipt mail so the customer's
 * sales team is the visible sender (see EmailFromCategory).
 */
export async function sendEmail(
  store: EmailOutbox,
  msg: EmailMessage,
  opts: { from?: EmailFromCategory } = {},
): Promise<EmailRecord> {
  const record: EmailRecord = {
    id: uid('mail'),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    mode,
    delivered: false,
    createdAt: nowIso(),
  }
  // Fall back to the default sender when sales wasn't built as a distinct
  // transport — see initEmail for when that happens.
  const send = (opts.from && senders[opts.from]) || senders.default
  if (send) {
    try {
      await send(msg)
      record.delivered = true
    } catch (error: any) {
      record.error = error.message
      console.warn(`[email] send failed → ${msg.to}: ${error.message}`)
    }
  } else {
    record.note = 'No SMTP configured; recorded to outbox only.'
    console.log(`[email:outbox] → ${msg.to} · ${msg.subject}`)
  }
  try {
    await store.appendEmail(record)
  } catch {
    /* outbox persistence is best-effort */
  }
  return record
}

/* ----- template engine ----- */

type TemplateVars = Record<string, string | number | null | undefined>

/**
 * Render an email template by slug. Lookup order:
 *  1. `email_templates` row (super-admin override) → use its subject/body.
 *  2. Otherwise → fall back to EMAIL_DEFAULTS for the slug.
 *
 * Both subject and body run through the same `{{var}}` substitution. Unknown
 * variables in a custom template silently render as empty — same shape as the
 * old `null + filter` pattern, just declarative.
 */
export async function renderTemplate(
  store: TemplateStore,
  slug: string,
  vars: TemplateVars,
): Promise<{ subject: string; text: string }> {
  const def = EMAIL_DEFAULTS[slug]
  if (!def) throw new Error(`Unknown email template: ${slug}`)
  // A store stub without getEmailTemplate falls back to the defaults — same
  // behaviour as "no row in DB", which keeps lightweight unit-test mocks valid.
  const override = typeof store.getEmailTemplate === 'function'
    ? await store.getEmailTemplate(slug).catch(() => null)
    : null
  const subjectTpl = override?.subject ?? def.subject
  const bodyTpl = override?.body ?? def.body
  const strVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(vars)) strVars[k] = v == null ? '' : String(v)
  return {
    subject: renderString(subjectTpl, strVars).trim(),
    text: tidyBlankLines(renderString(bodyTpl, strVars)).trim() + '\n',
  }
}

/** Optional `"<prefix>: <value>"` line, empty when the value is absent. Keeps
 *  the per-template wrappers below from open-coding the same ternary 8 times
 *  (each with its own risk of drifting label casing or spacing). */
function optionalLine(prefix: string, value: string | null | undefined): string {
  return value ? `${prefix}: ${value}` : ''
}

/** Optional inline ` (value)` clause, empty when the value is absent — companion
 *  to optionalLine for the templates that splice the company name into a sentence. */
function optionalClause(value: string | null | undefined): string {
  return value ? ` (${value})` : ''
}

/** Minimal HTML escape (XML special chars only). Sufficient for what we render
 *  inside <p> and href= contexts in our email shell below. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Outlook-friendly CTA button (table + bgcolor + inline styles). MSO clients
 *  ignore CSS `padding` on <a>, so the padding lives on the <td> and the <a>
 *  fills it via `display:inline-block`. */
function ctaButtonHtml(link: string, label: string): string {
  const safeLink = escapeHtml(link)
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;border-collapse:separate;">
  <tr><td align="center" bgcolor="#2563eb" style="border-radius:6px;">
    <a href="${safeLink}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(label)}</a>
  </td></tr>
</table>`
}

/** Wrap a rendered plain-text email body in a minimal HTML shell. Paragraphs
 *  (split by blank lines) become <p>; intra-paragraph newlines become <br>.
 *  Any paragraph that is *exactly* `cta.url` is replaced by a CTA button (so
 *  the long token URL disappears from the rendered HTML); the same url
 *  appearing inside a sentence is hyperlinked inline so a custom template that
 *  splices `{{link}}` into prose still renders correctly. Clients that don't
 *  render HTML still see the original `text` part of the multipart. */
function wrapEmailHtml(text: string, cta: { url: string; label: string }): string {
  const paragraphs = text.trim().split(/\n{2,}/g)
  const safeUrl = escapeHtml(cta.url)
  const inlineLink = `<a href="${safeUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a>`
  const bodyHtml = paragraphs
    .map((para) => {
      if (para.trim() === cta.url) return ctaButtonHtml(cta.url, cta.label)
      const html = escapeHtml(para).replace(/\n/g, '<br>').split(safeUrl).join(inlineLink)
      return `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#1f2937;">${html}</p>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
  <tr><td align="center" style="padding:24px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:32px;">
${bodyHtml}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

const SIGNATURE = '— Sigenic Partner Portal'

/**
 * Authoritative defaults for every outbound message the server can send. The
 * slug is the stable identifier (used in the email_templates table, the admin
 * editor URL, and every code call site below); `variables` documents what each
 * placeholder means so super-admins editing a template know what they can use.
 *
 * Adding a new template: drop a new entry here, expose a wrapper function below,
 * and call it from the relevant service.
 */
// Declaration order doubles as the order shown in the admin editor — keep
// related templates (invite group, signup group, ticket group, …) adjacent.
// emailTemplate.service.ts iterates Object.keys(EMAIL_DEFAULTS), so adding a
// new template here automatically surfaces it in the UI (no second array to
// sync, no silent drop if you forget to register it twice).
export const EMAIL_DEFAULTS: Record<string, EmailTemplateDef> = {
  ticket_created: {
    slug: 'ticket_created',
    name: 'Service request — created',
    description: 'Sent to the requester right after a service request is submitted (portal form or public landing form).',
    variables: [
      { name: 'ticketId', description: 'Internal request id', example: 'sr-001' },
      { name: 'ticketSubject', description: 'Request title', example: 'Brush torque instability on AS2000' },
      { name: 'requesterName', description: "Requester's display name", example: 'Wei Tan' },
      { name: 'category', description: 'Request type slug', example: 'support' },
      { name: 'priority', description: 'Urgency (low/medium/high)', example: 'high' },
      { name: 'productAreaLine', description: 'Optional "Product area: …" line, empty if none was provided', example: 'Product area: CMP' },
    ],
    subject: '[{{ticketId}}] {{ticketSubject}}',
    body: `Hi {{requesterName}},

Your {{category}} request has been received and routed to the Sigenic APAC team.

Ticket: {{ticketId}}
Subject: {{ticketSubject}}
Priority: {{priority}}
{{productAreaLine}}

You can track status and reply from the partner portal under Support.

${SIGNATURE}`,
  },

  ticket_updated: {
    slug: 'ticket_updated',
    name: 'Service request — new reply',
    description: 'Sent to the requester (or the originating contact for public submissions) when a new reply is posted on a request.',
    variables: [
      { name: 'ticketId', description: 'Internal request id', example: 'sr-001' },
      { name: 'ticketSubject', description: 'Request title', example: 'Brush torque instability on AS2000' },
      { name: 'ticketStatus', description: 'Current request status', example: 'open' },
      { name: 'authorName', description: 'Who posted the reply', example: 'Sigenic Support' },
      { name: 'messageBody', description: 'The reply text', example: 'We are looking into it — should have an update by EOD.' },
    ],
    subject: '[{{ticketId}}] New reply — {{ticketSubject}}',
    body: `There is a new update on ticket {{ticketId}}.

{{authorName}} wrote:
{{messageBody}}

Current status: {{ticketStatus}}

Open the portal to reply.

${SIGNATURE}`,
  },

  announcement: {
    slug: 'announcement',
    name: 'Announcement broadcast',
    description: 'Sent to every user in the announcement audience when an admin publishes a new announcement.',
    variables: [
      { name: 'title', description: 'Announcement title', example: 'Scheduled maintenance — SG ingest' },
      { name: 'body', description: 'Announcement body', example: 'The Singapore ingest cluster will be briefly unavailable on Sunday 02:00–03:00 SGT.' },
      { name: 'author', description: 'Who published the announcement', example: 'Priya Nair' },
    ],
    subject: 'Sigenic announcement: {{title}}',
    body: `{{title}}

{{body}}

— {{author}}`,
  },

  invite: {
    slug: 'invite',
    name: 'User invite',
    description: 'Sent to a newly invited user with the single-use link they follow to set their first password.',
    variables: [
      { name: 'fullName', description: 'Invitee full name', example: 'Mara Velasco' },
      { name: 'role', description: 'Role being assigned', example: 'customer_user' },
      { name: 'companyClause', description: 'Inline " (Company name)" suffix, empty if no company is set', example: ' (NovaCell Systems)' },
      { name: 'link', description: 'Single-use set-password URL', example: 'https://partner.sigenic.com/reset-password?token=…' },
    ],
    subject: 'You have been invited to the Sigenic Partner Portal',
    body: `Hi {{fullName}},

An account has been created for you on the Sigenic Partner Portal{{companyClause}}.
Role: {{role}}

Set your password to activate your account using the link below:

{{link}}

This link expires in 7 days and can only be used once. Once signed in you can
change your password anytime from your account settings.

${SIGNATURE}`,
  },

  password_reset_link: {
    slug: 'password_reset_link',
    name: 'Password reset link',
    description: 'Sent on both self-service "Forgot password" and admin-initiated password resets.',
    variables: [
      { name: 'fullName', description: 'Recipient full name', example: 'Wei Tan' },
      { name: 'link', description: 'Single-use reset URL', example: 'https://partner.sigenic.com/reset-password?token=…' },
    ],
    subject: 'Reset your Sigenic Partner Portal password',
    body: `Hi {{fullName}},

We received a request to reset the password for your Sigenic Partner Portal account.
Choose a new password using the link below:

{{link}}

This link expires in 1 hour and can only be used once.
If you didn't request this, you can safely ignore this email — your password won't change.

${SIGNATURE}`,
  },

  password_changed: {
    slug: 'password_changed',
    name: 'Password changed confirmation',
    description: "Sent to a user right after they successfully change their password via the self-service reset flow.",
    variables: [
      { name: 'fullName', description: 'Recipient full name', example: 'Wei Tan' },
    ],
    subject: 'Your Sigenic Partner Portal password was changed',
    body: `Hi {{fullName}},

Your Sigenic Partner Portal password was just changed. If this was you, no further action is needed.

If you didn't make this change, please contact your administrator right away.

${SIGNATURE}`,
  },

  invite_sent_receipt: {
    slug: 'invite_sent_receipt',
    name: 'Invite sent — inviter receipt',
    description: 'Sent to the person who issued an invite (or re-sent one) right after the invite goes out.',
    variables: [
      { name: 'inviterName', description: "Inviter's display name", example: 'Priya Nair' },
      { name: 'inviteeName', description: "Invitee's full name", example: 'Mara Velasco' },
      { name: 'inviteeEmail', description: "Invitee's email", example: 'mara@quantex.com' },
      { name: 'inviteeRole', description: 'Role being granted', example: 'customer_user' },
      { name: 'companyLine', description: 'Optional "Company: …" line, empty if no company', example: 'Company: Quantex Semiconductors' },
    ],
    subject: 'Invite sent to {{inviteeName}}',
    body: `Hi {{inviterName}},

Your invitation to the Sigenic Partner Portal has been sent to {{inviteeName}} <{{inviteeEmail}}>.
{{companyLine}}
Role:    {{inviteeRole}}

They have 7 days to follow the link and set their password. You will get another email from us once they accept.

${SIGNATURE}`,
  },

  invite_accepted: {
    slug: 'invite_accepted',
    name: 'Invite accepted — admin notification',
    description: "Sent to the inviter (plus other internal admins) once the invitee activates their account by setting their first password.",
    variables: [
      { name: 'inviteeName', description: "Invitee's full name", example: 'Mara Velasco' },
      { name: 'inviteeEmail', description: "Invitee's email", example: 'mara@quantex.com' },
      { name: 'inviteeRole', description: 'Role granted', example: 'customer_user' },
      { name: 'companyLine', description: 'Optional "Company: …" line, empty if no company', example: 'Company: Quantex Semiconductors' },
    ],
    subject: 'Invite accepted: {{inviteeName}}',
    body: `{{inviteeName}} <{{inviteeEmail}}> has accepted their invitation to the Sigenic Partner Portal and activated their account.

Role:    {{inviteeRole}}
{{companyLine}}

No action is needed — this is just a confirmation.

${SIGNATURE}`,
  },

  user_mutation_admin: {
    slug: 'user_mutation_admin',
    name: 'User created / deleted — admin notification',
    description: 'Sent to every internal admin (super_admin + admin) whenever a user account is created or removed.',
    variables: [
      { name: 'action', description: 'Either "created" or "deleted"', example: 'created' },
      { name: 'fullName', description: 'Target user full name', example: 'Mara Velasco' },
      { name: 'email', description: 'Target user email', example: 'mara@quantex.com' },
      { name: 'role', description: 'Target user role', example: 'customer_user' },
      { name: 'companyLine', description: 'Optional "Company: …" line, empty if no company', example: 'Company: Quantex Semiconductors' },
      { name: 'actor', description: "Display name of the admin who performed the action", example: 'Priya Nair' },
    ],
    subject: 'Portal user {{action}}: {{fullName}}',
    body: `A user account was {{action}} on the Sigenic Partner Portal.

Name:  {{fullName}}
Email: {{email}}
Role:  {{role}}
{{companyLine}}
{{action}} by: {{actor}}

${SIGNATURE}`,
  },

  calculator_lead: {
    slug: 'calculator_lead',
    name: 'Calculator submission — admin notification',
    description: 'Sent to internal admins when an authenticated user submits a risk-calculator assessment ("Submit and Send Email").',
    variables: [
      { name: 'subjectName', description: 'Submitter name (or "Unknown") — used in the subject', example: 'Daniel Ong' },
      { name: 'riskTierLabel', description: 'Risk tier label', example: 'High' },
      { name: 'runId', description: 'Documentation / run id', example: 'run-001' },
      { name: 'submitterLine', description: '"From: …" line with name + email', example: 'From: Daniel Ong <daniel@quantex.com>' },
      { name: 'companyLine', description: 'Optional "Company: …" line, empty if no company', example: 'Company: Quantex Semiconductors' },
      { name: 'riskScore', description: 'Numeric overall risk score', example: '13.5' },
      { name: 'currency', description: 'Currency code', example: 'USD' },
      { name: 'valueLoss', description: 'Formatted annual yield-loss value', example: '18,291,000' },
      { name: 'preventiveMeasuresSection', description: 'Optional block including the heading, empty if none', example: 'Preventive measures already implemented:\nMonthly PM cycle' },
      { name: 'costsIncurredSection', description: 'Optional block including the heading, empty if none', example: 'Associated costs incurred:\n~$120k YTD' },
    ],
    subject: '[Calculator lead] {{subjectName}} — {{riskTierLabel}}',
    body: `A new risk-calculator submission was just received on the partner portal.

Documentation: {{runId}}
{{submitterLine}}
{{companyLine}}

Overall risk: {{riskScore}} / 15 ({{riskTierLabel}})
Annual yield-loss at stake: {{currency}} {{valueLoss}}

{{preventiveMeasuresSection}}

{{costsIncurredSection}}

See the full breakdown on the Calculator leads page in the admin dashboard.

${SIGNATURE}`,
  },

  calculator_submission_receipt: {
    slug: 'calculator_submission_receipt',
    name: 'Calculator submission — submitter receipt',
    description: 'Confirmation sent to the submitter themselves right after they submit a calculator assessment.',
    variables: [
      { name: 'recipientName', description: 'Submitter name, falls back to "there"', example: 'Daniel Ong' },
      { name: 'runId', description: 'Reference id for the submission', example: 'run-001' },
      { name: 'riskScore', description: 'Numeric overall risk score', example: '13.5' },
      { name: 'riskTierLabel', description: 'Risk tier label', example: 'High' },
      { name: 'currency', description: 'Currency code', example: 'USD' },
      { name: 'valueLoss', description: 'Formatted annual yield-loss value', example: '18,291,000' },
    ],
    subject: 'We received your risk & yield-loss assessment',
    body: `Hi {{recipientName}},

Thanks for submitting your risk and yield-loss assessment on the Sigenic Partner Portal.
This email confirms we have received it.

Reference: {{runId}}
Overall risk: {{riskScore}} / 15 ({{riskTierLabel}})
Estimated annual yield-loss at stake: {{currency}} {{valueLoss}}

The Sigenic team can see your submission and may reach out if any follow-up is needed.
You can review this assessment anytime by signing in to the partner portal.

${SIGNATURE}`,
  },

  account_removed: {
    slug: 'account_removed',
    name: 'Account removed',
    description: 'Sent to a user whose portal account has just been deleted by an admin.',
    variables: [
      { name: 'fullName', description: 'Target user full name', example: 'Mara Velasco' },
      { name: 'companyClause', description: 'Inline " (Company name)" suffix, empty if no company', example: ' (NovaCell Systems)' },
    ],
    subject: 'Your Sigenic Partner Portal access has been removed',
    body: `Hi {{fullName}},

Your account on the Sigenic Partner Portal{{companyClause}} has been removed, and you no longer have access.

If you believe this was a mistake, please contact your administrator.

${SIGNATURE}`,
  },

  signup_receipt: {
    slug: 'signup_receipt',
    name: 'Self-service sign-up — receipt',
    description: 'Sent to a self-registered user confirming their request was received and is awaiting approval.',
    variables: [
      { name: 'fullName', description: 'Registrant full name', example: 'Aisha Rahman' },
      { name: 'companyClause', description: 'Inline " (Company name)" suffix, empty if none', example: ' (Lumen Photonics)' },
      { name: 'reviewParagraph', description: 'Sentence describing who reviews the request (varies by new-company vs existing-company)', example: 'A company administrator (or the Sigenic team) will review your request.' },
    ],
    subject: 'We received your Sigenic Partner Portal sign-up',
    body: `Hi {{fullName}},

Thanks for signing up for the Sigenic Partner Portal{{companyClause}}.
Your request has been received and is now awaiting approval.

{{reviewParagraph}}
Once approved, you will receive a separate email with a link to set your password and sign in.

No action is needed from you right now.

${SIGNATURE}`,
  },

  signup_pending_admin: {
    slug: 'signup_pending_admin',
    name: 'Self-service sign-up — approval needed',
    description: "Notifies approvers (the company's own admins for an existing-company request, or internal admins for a new-company request) that a sign-up is awaiting review.",
    variables: [
      { name: 'fullName', description: 'Registrant full name', example: 'Aisha Rahman' },
      { name: 'email', description: 'Registrant email', example: 'aisha@lumenphotonics.io' },
      { name: 'companyLine', description: 'Optional "Company: … (new company request)" line, empty if none', example: 'Company: Lumen Photonics (new company request)' },
      { name: 'reviewInstruction', description: 'Either "Review and approve or reject: <link>" or a fallback "Open the portal …" sentence', example: 'Review and approve or reject: https://partner.sigenic.com/app/admin/signups' },
    ],
    subject: 'Sign-up awaiting approval: {{fullName}}',
    body: `A new user has requested access to the Sigenic Partner Portal and is awaiting approval.

Name:  {{fullName}}
Email: {{email}}
{{companyLine}}

{{reviewInstruction}}

${SIGNATURE}`,
  },

  signup_rejected: {
    slug: 'signup_rejected',
    name: 'Self-service sign-up — rejected',
    description: "Sent to a self-registered user whose sign-up was declined.",
    variables: [
      { name: 'fullName', description: 'Registrant full name', example: 'Aisha Rahman' },
      { name: 'companyClause', description: 'Inline " (Company name)" suffix, empty if none', example: ' (Lumen Photonics)' },
      { name: 'reasonSection', description: 'Optional "Reason: …" block, empty if no reason was given', example: 'Reason: Company already covered by an existing distributor account.' },
    ],
    subject: 'Your Sigenic Partner Portal sign-up was not approved',
    body: `Hi {{fullName}},

Thank you for your interest in the Sigenic Partner Portal{{companyClause}}.
After review, your sign-up request was not approved at this time.

{{reasonSection}}

If you believe this was a mistake, please contact your company administrator or the Sigenic team.

${SIGNATURE}`,
  },
}

/* ----- message factories (thin wrappers around renderTemplate) ----- */

export function ticketCreatedEmail(
  store: TemplateStore,
  ticket: {
    id: string
    subject: string
    requester: string
    category: string
    priority: string
    productArea?: string
  },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'ticket_created', {
    ticketId: ticket.id,
    ticketSubject: ticket.subject,
    requesterName: ticket.requester,
    category: ticket.category,
    priority: ticket.priority,
    productAreaLine: optionalLine('Product area', ticket.productArea),
  })
}

export function ticketUpdatedEmail(
  store: TemplateStore,
  ticket: { id: string; subject: string; status: string },
  message: { author: string; body: string },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'ticket_updated', {
    ticketId: ticket.id,
    ticketSubject: ticket.subject,
    ticketStatus: ticket.status,
    authorName: message.author,
    messageBody: message.body,
  })
}

export function announcementEmail(
  store: TemplateStore,
  announcement: { title: string; body: string; author: string },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'announcement', {
    title: announcement.title,
    body: announcement.body,
    author: announcement.author,
  })
}

export async function inviteEmail(
  store: TemplateStore,
  invite: { fullName: string; role: string; companyName?: string | null; link: string },
): Promise<{ subject: string; text: string; html: string }> {
  const rendered = await renderTemplate(store, 'invite', {
    fullName: invite.fullName,
    role: invite.role,
    companyClause: optionalClause(invite.companyName),
    link: invite.link,
  })
  return {
    ...rendered,
    html: wrapEmailHtml(rendered.text, { url: invite.link, label: 'Set your password' }),
  }
}

export async function passwordResetLinkEmail(
  store: TemplateStore,
  params: { fullName: string; link: string },
): Promise<{ subject: string; text: string; html: string }> {
  const rendered = await renderTemplate(store, 'password_reset_link', params)
  return {
    ...rendered,
    html: wrapEmailHtml(rendered.text, { url: params.link, label: 'Reset password' }),
  }
}

export function passwordChangedEmail(
  store: TemplateStore,
  user: { fullName: string },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'password_changed', { fullName: user.fullName })
}

export function inviteSentReceiptEmail(
  store: TemplateStore,
  params: {
    inviterName: string
    inviteeName: string
    inviteeEmail: string
    inviteeRole: string
    companyName?: string | null
  },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'invite_sent_receipt', {
    inviterName: params.inviterName,
    inviteeName: params.inviteeName,
    inviteeEmail: params.inviteeEmail,
    inviteeRole: params.inviteeRole,
    companyLine: optionalLine('Company', params.companyName),
  })
}

export function inviteAcceptedEmail(
  store: TemplateStore,
  params: {
    inviteeName: string
    inviteeEmail: string
    inviteeRole: string
    companyName?: string | null
  },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'invite_accepted', {
    inviteeName: params.inviteeName,
    inviteeEmail: params.inviteeEmail,
    inviteeRole: params.inviteeRole,
    companyLine: optionalLine('Company', params.companyName),
  })
}

export function userMutationAdminEmail(
  store: TemplateStore,
  params: {
    action: 'created' | 'deleted'
    fullName: string
    email: string
    role: string
    companyName?: string | null
    actor: string
  },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'user_mutation_admin', {
    action: params.action,
    fullName: params.fullName,
    email: params.email,
    role: params.role,
    companyLine: optionalLine('Company', params.companyName),
    actor: params.actor,
  })
}

export function calculatorLeadEmail(
  store: TemplateStore,
  params: {
    runId: string
    result: RiskResult
    submitterName?: string | null
    submitterEmail?: string | null
    companyName?: string | null
    additional?: CalcAdditionalInfo | null
  },
): Promise<{ subject: string; text: string }> {
  const tierLabel = RISK_TIER_LABEL[params.result.overallTier] ?? params.result.overallTier
  const submitterName = params.submitterName ?? 'Unknown'
  const submitterLine = `From: ${submitterName}${params.submitterEmail ? ` <${params.submitterEmail}>` : ''}`
  return renderTemplate(store, 'calculator_lead', {
    subjectName: submitterName,
    riskTierLabel: tierLabel,
    runId: params.runId,
    submitterLine,
    companyLine: optionalLine('Company', params.companyName),
    riskScore: params.result.overallRiskScore,
    currency: params.result.currency,
    valueLoss: params.result.totalAnnualValueLoss.toLocaleString(),
    preventiveMeasuresSection: params.additional?.preventiveMeasures
      ? `Preventive measures already implemented:\n${params.additional.preventiveMeasures}`
      : '',
    costsIncurredSection: params.additional?.costsIncurred
      ? `Associated costs incurred:\n${params.additional.costsIncurred}`
      : '',
  })
}

export function calculatorSubmissionReceiptEmail(
  store: TemplateStore,
  params: { recipientName?: string | null; runId: string; result: RiskResult },
): Promise<{ subject: string; text: string }> {
  const tierLabel = RISK_TIER_LABEL[params.result.overallTier] ?? params.result.overallTier
  return renderTemplate(store, 'calculator_submission_receipt', {
    recipientName: params.recipientName || 'there',
    runId: params.runId,
    riskScore: params.result.overallRiskScore,
    riskTierLabel: tierLabel,
    currency: params.result.currency,
    valueLoss: params.result.totalAnnualValueLoss.toLocaleString(),
  })
}

export function accountRemovedEmail(
  store: TemplateStore,
  params: { fullName: string; companyName?: string | null },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'account_removed', {
    fullName: params.fullName,
    companyClause: optionalClause(params.companyName),
  })
}

/* ----- self-service sign-up (client feedback 2026-06) ----- */

export function signupReceiptEmail(
  store: TemplateStore,
  params: { fullName: string; companyName?: string | null; newCompany?: boolean },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'signup_receipt', {
    fullName: params.fullName,
    companyClause: optionalClause(params.companyName),
    reviewParagraph: params.newCompany
      ? 'Because this is a new company, the Sigenic team will review and approve it.'
      : 'A company administrator (or the Sigenic team) will review your request.',
  })
}

export function signupPendingAdminEmail(
  store: TemplateStore,
  params: {
    fullName: string
    email: string
    companyName?: string | null
    newCompany?: boolean
    reviewLink?: string
  },
): Promise<{ subject: string; text: string }> {
  // companyLine carries an extra "(new company request)" suffix when applicable,
  // so it doesn't quite fit the bare optionalLine helper — composed inline.
  const companyLabel = params.companyName
    ? `${params.companyName}${params.newCompany ? ' (new company request)' : ''}`
    : undefined
  return renderTemplate(store, 'signup_pending_admin', {
    fullName: params.fullName,
    email: params.email,
    companyLine: optionalLine('Company', companyLabel),
    reviewInstruction: params.reviewLink
      ? `Review and approve or reject: ${params.reviewLink}`
      : 'Open the portal to review and approve or reject this request.',
  })
}

export function signupRejectedEmail(
  store: TemplateStore,
  params: { fullName: string; companyName?: string | null; reason?: string | null },
): Promise<{ subject: string; text: string }> {
  return renderTemplate(store, 'signup_rejected', {
    fullName: params.fullName,
    companyClause: optionalClause(params.companyName),
    reasonSection: optionalLine('Reason', params.reason),
  })
}

/* ----- admin fan-out helpers ----- */

/**
 * Fan out one message to every active internal admin (super_admin + admin). SQL
 * filter avoids dragging the full users table into Node. Each send is best-effort,
 * so a flaky SMTP recipient never poisons the rest of the batch.
 *
 * `excludeUserId` skips one admin — used when the inviter is also an internal
 * admin and is already getting a dedicated inviter-receipt email; without it
 * they'd receive two copies of every invite they send.
 */
export async function notifyInternalAdmins(
  store: AdminFanoutStore,
  message: { subject: string; text: string },
  opts: { excludeUserId?: string | null; from?: EmailFromCategory } = {},
): Promise<void> {
  const admins = await store.list('users', {
    where: "role = ANY($1::text[]) AND status <> 'inactive'",
    params: [INTERNAL_MANAGE],
  })
  const recipients = opts.excludeUserId ? admins.filter((a) => a.id !== opts.excludeUserId) : admins
  await Promise.all(
    recipients.map((a) => sendEmail(store, { to: a.email, ...message }, { from: opts.from }).catch(() => {})),
  )
}

/**
 * Fan out one message to a company's own admins (distributor_admin / customer_admin)
 * who can act on it — active accounts only. Used to alert a company's admins that one
 * of their users has self-registered and is awaiting their approval. Best-effort per
 * recipient, mirroring notifyInternalAdmins.
 */
export async function notifyCompanyAdmins(
  store: AdminFanoutStore,
  companyId: string,
  message: { subject: string; text: string },
): Promise<void> {
  const admins = await store.list('users', {
    where: "company_id = $1 AND role IN ('distributor_admin','customer_admin') AND status = 'active'",
    params: [companyId],
  })
  await Promise.all(admins.map((a) => sendEmail(store, { to: a.email, ...message }).catch(() => {})))
}
