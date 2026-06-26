import { uid, nowIso } from '../util/ids'
import { INTERNAL_MANAGE } from '../../shared/permissions'
import { RISK_TIER_LABEL } from '../../shared/calc'
import { resilientFetch, withRetry } from '../integration/zendesk'
import type { CalcAdditionalInfo, RiskResult } from '../../shared/types'

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

let send: ((msg: EmailMessage) => Promise<void>) | null = null
let mode = 'outbox'

const FROM = process.env.EMAIL_FROM || 'Sigenic Partner Portal <no-reply@sigenic.com>'

/** Split `"Display Name <addr@domain>"` into the {email, name} shape MailerSend expects. */
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^(.+?)\s*<(.+)>$/)
  if (m) return { email: m[2].trim(), name: m[1].trim() }
  return { email: from.trim() }
}

/**
 * Initialise email transport. Priority:
 *  1. MAILERSEND_API_TOKEN set → use MailerSend HTTPS API (port 443). Required
 *     on PaaS like Render that block outbound SMTP ports (25/465/587). Reuses
 *     the shared resilientFetch + withRetry so a stalled provider can't hang
 *     the request handler and 429/5xx are retried with backoff.
 *  2. SMTP_HOST set → nodemailer over SMTP (local mailpit, Gmail relay, etc).
 *  3. Otherwise → outbox-only mode, every send is recorded but not delivered.
 */
export async function initEmail(): Promise<string> {
  const mailerSendToken = process.env.MAILERSEND_API_TOKEN
  if (mailerSendToken) {
    const from = parseFrom(FROM)
    send = ({ to, subject, text, html }) =>
      withRetry(
        () =>
          resilientFetch(
            'https://api.mailersend.com/v1/email',
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${mailerSendToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from,
                to: [{ email: to }],
                subject,
                text,
                html: html || undefined,
              }),
            },
            {
              parseError: (payload, status) =>
                payload?.message || payload?.errors?.[0]?.message || `MailerSend ${status}`,
            },
          ),
        { label: 'mailersend' },
      )
    mode = 'mailersend-http'
    console.log('[email] MailerSend HTTPS API ready (api.mailersend.com).')
    return mode
  }
  const host = process.env.SMTP_HOST
  if (!host) {
    console.warn('[email] SMTP_HOST unset — emails will be recorded to the outbox instead of sent.')
    return mode
  }
  try {
    const { default: nodemailer } = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    send = ({ to, subject, text, html }) =>
      transporter.sendMail({ from: FROM, to, subject, text, html: html || undefined })
    mode = 'smtp'
    console.log(`[email] SMTP transport ready (${host}:${process.env.SMTP_PORT || 1025}).`)
  } catch (error: any) {
    console.warn(`[email] Failed to init SMTP (${error.message}) — falling back to outbox.`)
  }
  return mode
}

export function emailMode(): string {
  return mode
}

/**
 * Send (or record) an email and persist a copy to the store-backed outbox so
 * admins can verify delivery even without a real mailbox.
 */
export async function sendEmail(store: EmailOutbox, msg: EmailMessage): Promise<EmailRecord> {
  const record: EmailRecord = {
    id: uid('mail'),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    mode,
    delivered: false,
    createdAt: nowIso(),
  }
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

/* ----- message templates ----- */

export function ticketCreatedEmail(ticket: {
  id: string
  subject: string
  requester: string
  category: string
  priority: string
  productArea?: string
}): { subject: string; text: string } {
  return {
    subject: `[${ticket.id}] ${ticket.subject}`,
    text: [
      `Hi ${ticket.requester},`,
      '',
      `Your ${ticket.category} request has been received and routed to the Sigenic APAC team.`,
      '',
      `Ticket: ${ticket.id}`,
      `Subject: ${ticket.subject}`,
      `Priority: ${ticket.priority}`,
      ticket.productArea ? `Product area: ${ticket.productArea}` : null,
      '',
      'You can track status and reply from the partner portal under Support.',
      '',
      '— Sigenic Partner Portal',
    ]
      .filter((line) => line !== null)
      .join('\n'),
  }
}

export function ticketUpdatedEmail(
  ticket: { id: string; subject: string; status: string },
  message: { author: string; body: string },
): { subject: string; text: string } {
  return {
    subject: `[${ticket.id}] New reply — ${ticket.subject}`,
    text: [
      `There is a new update on ticket ${ticket.id}.`,
      '',
      `${message.author} wrote:`,
      message.body,
      '',
      `Current status: ${ticket.status}`,
      '',
      'Open the portal to reply.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

export function announcementEmail(announcement: { title: string; body: string; author: string }): {
  subject: string
  text: string
} {
  return {
    subject: `Sigenic announcement: ${announcement.title}`,
    text: [announcement.title, '', announcement.body, '', `— ${announcement.author}`].join('\n'),
  }
}

export function inviteEmail(invite: { fullName: string; role: string; companyName?: string; link: string }): {
  subject: string
  text: string
} {
  return {
    subject: 'You have been invited to the Sigenic Partner Portal',
    text: [
      `Hi ${invite.fullName},`,
      '',
      `An account has been created for you on the Sigenic Partner Portal${invite.companyName ? ` (${invite.companyName})` : ''}.`,
      `Role: ${invite.role}`,
      '',
      'Set your password to activate your account using the link below:',
      '',
      invite.link,
      '',
      'This link expires in 7 days and can only be used once. Once signed in you can',
      'change your password anytime from your account settings.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/** Reset link a user follows to set a new password — used by both self-service
 *  "forgot password" and admin-initiated resets from the user roster. */
export function passwordResetLinkEmail(params: { fullName: string; link: string }): { subject: string; text: string } {
  return {
    subject: 'Reset your Sigenic Partner Portal password',
    text: [
      `Hi ${params.fullName},`,
      '',
      'We received a request to reset the password for your Sigenic Partner Portal account.',
      'Choose a new password using the link below:',
      '',
      params.link,
      '',
      'This link expires in 1 hour and can only be used once.',
      "If you didn't request this, you can safely ignore this email — your password won't change.",
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/** Confirmation sent after a password is changed via the self-service reset flow. */
export function passwordChangedEmail(user: { fullName: string }): { subject: string; text: string } {
  return {
    subject: 'Your Sigenic Partner Portal password was changed',
    text: [
      `Hi ${user.fullName},`,
      '',
      'Your Sigenic Partner Portal password was just changed. If this was you, no further action is needed.',
      '',
      "If you didn't make this change, please contact your administrator right away.",
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/**
 * Receipt sent to the *inviter* right after they invite a user — confirms the
 * invite went out and tells them they'll hear back when the invitee accepts.
 * Distinct from the internal-admin fan-out so the actual inviter always gets a
 * direct heads-up even if they aren't part of the admin pool (client feedback
 * 2026-06: "no notification … person inviting").
 */
export function inviteSentReceiptEmail(params: {
  inviterName: string
  inviteeName: string
  inviteeEmail: string
  inviteeRole: string
  companyName?: string | null
}): { subject: string; text: string } {
  return {
    subject: `Invite sent to ${params.inviteeName}`,
    text: [
      `Hi ${params.inviterName},`,
      '',
      `Your invitation to the Sigenic Partner Portal has been sent to ${params.inviteeName} <${params.inviteeEmail}>.`,
      ...(params.companyName ? [`Company: ${params.companyName}`] : []),
      `Role:    ${params.inviteeRole}`,
      '',
      'They have 7 days to follow the link and set their password. You will get another email from us once they accept.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/**
 * Notify the inviter (and other internal admins) when an invitee has accepted
 * their invite and activated their account. Sent from auth.service when a user's
 * first password set flips them from `invited` to `active` (client feedback 2026-06).
 */
export function inviteAcceptedEmail(params: {
  inviteeName: string
  inviteeEmail: string
  inviteeRole: string
  companyName?: string | null
}): { subject: string; text: string } {
  return {
    subject: `Invite accepted: ${params.inviteeName}`,
    text: [
      `${params.inviteeName} <${params.inviteeEmail}> has accepted their invitation to the Sigenic Partner Portal and activated their account.`,
      '',
      `Role:    ${params.inviteeRole}`,
      ...(params.companyName ? [`Company: ${params.companyName}`] : []),
      '',
      'No action is needed — this is just a confirmation.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/** Notify internal admins when a portal user is created or deleted (per client request). */
export function userMutationAdminEmail(params: {
  action: 'created' | 'deleted'
  fullName: string
  email: string
  role: string
  companyName?: string | null
  actor: string
}): { subject: string; text: string } {
  return {
    subject: `Portal user ${params.action}: ${params.fullName}`,
    text: [
      `A user account was ${params.action} ${params.action === 'created' ? 'on' : 'from'} the Sigenic Partner Portal.`,
      '',
      `Name:  ${params.fullName}`,
      `Email: ${params.email}`,
      `Role:  ${params.role}`,
      ...(params.companyName ? [`Company: ${params.companyName}`] : []),
      `${params.action === 'created' ? 'Created' : 'Deleted'} by: ${params.actor}`,
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

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
  opts: { excludeUserId?: string | null } = {},
): Promise<void> {
  const admins = await store.list('users', {
    where: "role = ANY($1::text[]) AND status <> 'inactive'",
    params: [INTERNAL_MANAGE],
  })
  const recipients = opts.excludeUserId ? admins.filter((a) => a.id !== opts.excludeUserId) : admins
  await Promise.all(recipients.map((a) => sendEmail(store, { to: a.email, ...message }).catch(() => {})))
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

/** "New calculator submission" notification — sent to internal admins on Submit and Send Email. */
export function calculatorLeadEmail(params: {
  runId: string
  result: RiskResult
  submitterName?: string | null
  submitterEmail?: string | null
  companyName?: string | null
  additional?: CalcAdditionalInfo | null
}): { subject: string; text: string } {
  const tierLabel = RISK_TIER_LABEL[params.result.overallTier] ?? params.result.overallTier
  const lines: (string | null)[] = [
    'A new risk-calculator submission was just received on the partner portal.',
    '',
    `Documentation: ${params.runId}`,
    `From: ${params.submitterName ?? 'Unknown'}${params.submitterEmail ? ` <${params.submitterEmail}>` : ''}`,
    params.companyName ? `Company: ${params.companyName}` : null,
    '',
    `Overall risk: ${params.result.overallRiskScore} / 15 (${tierLabel})`,
    `Annual yield-loss at stake: ${params.result.currency} ${params.result.totalAnnualValueLoss.toLocaleString()}`,
    params.additional?.preventiveMeasures ? `\nPreventive measures already implemented:\n${params.additional.preventiveMeasures}` : null,
    params.additional?.costsIncurred ? `\nAssociated costs incurred:\n${params.additional.costsIncurred}` : null,
    '',
    'See the full breakdown on the Calculator leads page in the admin dashboard.',
    '',
    '— Sigenic Partner Portal',
  ]
  return {
    subject: `[Calculator lead] ${params.submitterName ?? 'Unknown'} — ${tierLabel}`,
    text: lines.filter((l) => l !== null).join('\n'),
  }
}

/**
 * Receipt emailed to the submitter themselves right after they submit an
 * assessment. The client asked for an explicit "we got it" confirmation so the
 * submitter knows it landed and that the Sigenic team may follow up.
 */
export function calculatorSubmissionReceiptEmail(params: {
  recipientName?: string | null
  runId: string
  result: RiskResult
}): { subject: string; text: string } {
  const tierLabel = RISK_TIER_LABEL[params.result.overallTier] ?? params.result.overallTier
  return {
    subject: 'We received your risk & yield-loss assessment',
    text: [
      `Hi ${params.recipientName || 'there'},`,
      '',
      'Thanks for submitting your risk and yield-loss assessment on the Sigenic Partner Portal.',
      'This email confirms we have received it.',
      '',
      `Reference: ${params.runId}`,
      `Overall risk: ${params.result.overallRiskScore} / 15 (${tierLabel})`,
      `Estimated annual yield-loss at stake: ${params.result.currency} ${params.result.totalAnnualValueLoss.toLocaleString()}`,
      '',
      'The Sigenic team can see your submission and may reach out if any follow-up is needed.',
      'You can review this assessment anytime by signing in to the partner portal.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/** Sent to a user whose account has just been deleted. */
export function accountRemovedEmail(params: { fullName: string; companyName?: string | null }): { subject: string; text: string } {
  return {
    subject: 'Your Sigenic Partner Portal access has been removed',
    text: [
      `Hi ${params.fullName},`,
      '',
      `Your account on the Sigenic Partner Portal${params.companyName ? ` (${params.companyName})` : ''} has been removed, and you no longer have access.`,
      '',
      'If you believe this was a mistake, please contact your administrator.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/* ----- self-service sign-up (client feedback 2026-06) ----- */

/** Receipt sent to a self-registered user confirming their request is awaiting approval. */
export function signupReceiptEmail(params: { fullName: string; companyName?: string | null; newCompany?: boolean }): { subject: string; text: string } {
  return {
    subject: 'We received your Sigenic Partner Portal sign-up',
    text: [
      `Hi ${params.fullName},`,
      '',
      `Thanks for signing up for the Sigenic Partner Portal${params.companyName ? ` (${params.companyName})` : ''}.`,
      'Your request has been received and is now awaiting approval.',
      '',
      params.newCompany
        ? 'Because this is a new company, the Sigenic team will review and approve it.'
        : 'A company administrator (or the Sigenic team) will review your request.',
      'Once approved, you will receive a separate email with a link to set your password and sign in.',
      '',
      'No action is needed from you right now.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/**
 * Notify an approver that a new sign-up is awaiting review. Sent to the company's
 * own admins for an existing-company request, or to internal admins for a
 * new-company request (whoever is responsible for approving it).
 */
export function signupPendingAdminEmail(params: {
  fullName: string
  email: string
  companyName?: string | null
  newCompany?: boolean
}): { subject: string; text: string } {
  return {
    subject: `Sign-up awaiting approval: ${params.fullName}`,
    text: [
      'A new user has requested access to the Sigenic Partner Portal and is awaiting approval.',
      '',
      `Name:  ${params.fullName}`,
      `Email: ${params.email}`,
      ...(params.companyName ? [`Company: ${params.companyName}${params.newCompany ? ' (new company request)' : ''}`] : []),
      '',
      'Review and approve or reject this request from User management in the portal.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}

/** Sent to a self-registered user whose sign-up was declined. */
export function signupRejectedEmail(params: { fullName: string; companyName?: string | null; reason?: string | null }): { subject: string; text: string } {
  return {
    subject: 'Your Sigenic Partner Portal sign-up was not approved',
    text: [
      `Hi ${params.fullName},`,
      '',
      `Thank you for your interest in the Sigenic Partner Portal${params.companyName ? ` (${params.companyName})` : ''}.`,
      'After review, your sign-up request was not approved at this time.',
      ...(params.reason ? ['', `Reason: ${params.reason}`] : []),
      '',
      'If you believe this was a mistake, please contact your company administrator or the Sigenic team.',
      '',
      '— Sigenic Partner Portal',
    ].join('\n'),
  }
}
