#!/usr/bin/env node
// One-off SMTP connectivity + credential check for the Gmail/Workspace cutover.
// Verifies the handshake + auth, then sends one test email so you can confirm
// the app password works BEFORE wiring it into Hostinger. Run it locally first
// (isolates "bad credential" from "host blocks outbound 465/587").
//
// Usage:
//   SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
//   SMTP_USER=sales@sigenic.com SMTP_PASS='xxxx xxxx xxxx xxxx' \
//   node scripts/smtp-check.mjs --to you@example.com
import nodemailer from 'nodemailer'

const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined }
const { SMTP_HOST, SMTP_PORT = '465', SMTP_SECURE = 'true', SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env
const to = arg('--to') || SMTP_USER

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP_HOST / SMTP_USER / SMTP_PASS in env.')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === 'true',
  auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') }, // Gmail ignores spaces; strip to be safe
})

console.log(`Connecting to ${SMTP_HOST}:${SMTP_PORT} (secure=${SMTP_SECURE}) as ${SMTP_USER} ...`)
try {
  await transporter.verify()
  console.log('OK: SMTP handshake + auth succeeded')
} catch (e) {
  console.error('FAIL verify:', e.message)
  process.exit(1)
}

const from = EMAIL_FROM || `Sigenic Partner Portal <${SMTP_USER}>`
try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Sigenic portal SMTP test',
    text: 'If you can read this, Gmail SMTP works from this host.',
  })
  console.log(`OK: sent ${info.messageId} -> ${to}`)
} catch (e) {
  console.error('FAIL send:', e.message)
  process.exit(1)
}
