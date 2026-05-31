import crypto from 'node:crypto'

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
    id: `mail-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    to,
    subject,
    text,
    mode,
    delivered: false,
    createdAt: new Date().toISOString(),
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
