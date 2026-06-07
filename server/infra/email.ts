import { uid, nowIso } from '../util/ids'
import { INTERNAL_MANAGE } from '../../shared/permissions'
import { RISK_TIER_LABEL } from '../../shared/calc'
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

// nodemailer transport is loaded lazily and has no shared type here — kept as `any`.
let transporter: any = null
let mode = 'outbox'

const FROM = process.env.EMAIL_FROM || 'Sigenic Partner Portal <no-reply@sigenic.com>'

/**
 * Initialise email transport. With SMTP_HOST set we send for real (works with
 * MailHog/Mailpit locally, or any SMTP provider in prod). Without it we fall
 * back to an "outbox" that records every message so the feature stays testable.
 */
export async function initEmail(): Promise<string> {
  const host = process.env.SMTP_HOST
  if (!host) {
    console.warn('[email] SMTP_HOST unset — emails will be recorded to the outbox instead of sent.')
    return mode
  }
  try {
    const { default: nodemailer } = await import('nodemailer')
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
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
export async function sendEmail(
  store: EmailOutbox,
  { to, subject, text, html }: { to: string; subject: string; text?: string; html?: string },
): Promise<EmailRecord> {
  const record: EmailRecord = {
    id: uid('mail'),
    to,
    subject,
    text,
    mode,
    delivered: false,
    createdAt: nowIso(),
  }
  if (transporter) {
    try {
      await transporter.sendMail({ from: FROM, to, subject, text, html: html || undefined })
      record.delivered = true
    } catch (error: any) {
      record.error = error.message
      console.warn(`[email] send failed → ${to}: ${error.message}`)
    }
  } else {
    record.note = 'No SMTP configured; recorded to outbox only.'
    console.log(`[email:outbox] → ${to} · ${subject}`)
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
 */
export async function notifyInternalAdmins(
  store: AdminFanoutStore,
  message: { subject: string; text: string },
): Promise<void> {
  const admins = await store.list('users', {
    where: "role = ANY($1::text[]) AND status <> 'inactive'",
    params: [INTERNAL_MANAGE],
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
