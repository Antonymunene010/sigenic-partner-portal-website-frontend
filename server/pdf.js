/**
 * Server-side PDF generation (PRD 6.5 "View invoices (PDF)" and 6.8
 * "Exportable report"). Uses pdfkit's built-in fonts so it needs no system
 * font packages inside the container.
 */

// Sigenic palette (PRD §11): near-black ink + gold accent.
const BRAND = '#0E0E10'
const ACCENT = '#C8A75B'
const MUTED = '#6b7280'

const usd = (n) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const num = (n, d = 1) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

async function newDoc() {
  const { default: PDFDocument } = await import('pdfkit')
  return new PDFDocument({ size: 'A4', margin: 54 })
}

function collect(doc) {
  return new Promise((resolve, reject) => {
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function header(doc, title) {
  doc.fillColor(BRAND).fontSize(20).font('Helvetica-Bold').text('Sigenic', { continued: true })
  doc.fillColor(ACCENT).text(' /', { continued: true })
  doc.fillColor(MUTED).fontSize(11).font('Helvetica').text('  Partner Portal')
  doc.moveDown(0.3)
  doc.fillColor(BRAND).fontSize(15).font('Helvetica-Bold').text(title)
  doc.moveTo(54, doc.y + 4).lineTo(541, doc.y + 4).strokeColor('#e5e7eb').stroke()
  doc.moveDown(1)
}

function row(doc, label, value) {
  const y = doc.y
  doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 54, y)
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text(String(value), 200, y)
  doc.moveDown(0.6)
}

/** Build an invoice PDF buffer. */
export async function invoicePdf(invoice, { company, billingContact, email } = {}) {
  const doc = await newDoc()
  const done = collect(doc)
  header(doc, `Invoice ${invoice.id}`)

  doc.fillColor(MUTED).fontSize(10).font('Helvetica')
  row(doc, 'Bill to', company || 'Partner account')
  if (billingContact) row(doc, 'Billing contact', billingContact)
  if (email) row(doc, 'Email', email)
  row(doc, 'Period', `${fmtDate(invoice.periodStart)} — ${fmtDate(invoice.periodEnd)}`)
  row(doc, 'Issued', fmtDate(invoice.issuedAt))
  row(doc, 'Status', String(invoice.status).toUpperCase())
  doc.moveDown(0.6)

  const lineItems =
    Array.isArray(invoice.lineItems) && invoice.lineItems.length
      ? invoice.lineItems
      : [{ description: 'Sigenic optimization subscription — monthly', amount: invoice.amount }]

  // table head
  let y = doc.y + 6
  doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold')
  doc.text('DESCRIPTION', 54, y)
  doc.text('AMOUNT', 441, y, { width: 100, align: 'right' })
  doc.moveTo(54, y + 14).lineTo(541, y + 14).strokeColor('#e5e7eb').stroke()
  y += 22

  doc.font('Helvetica').fillColor(BRAND).fontSize(10)
  for (const item of lineItems) {
    doc.text(item.description, 54, y, { width: 360 })
    doc.text(usd(item.amount), 441, y, { width: 100, align: 'right' })
    y = doc.y + 6
  }

  doc.moveTo(54, y).lineTo(541, y).strokeColor('#e5e7eb').stroke()
  y += 10
  doc.font('Helvetica-Bold').fontSize(12)
  doc.fillColor(MUTED).text('Total due', 54, y)
  doc.fillColor(BRAND).text(usd(invoice.amount), 441, y, { width: 100, align: 'right' })

  doc.moveDown(4)
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font('Helvetica')
    .text('Net 30 against the master services agreement. Questions? Open a billing ticket in the portal.', 54, doc.y, { width: 487 })

  doc.end()
  return done
}

const range = (r, fmt = (x) => x) => (r ? `${fmt(r.min)} — ${fmt(r.max)}` : '—')
const usdRange = (r) => range(r, usd)
const pctRange = (r) => range(r, (x) => `${num(x)}%`)

/** Build a Score Calculator ROI report PDF buffer (range-based, PRD calculator_runs). */
export async function reportPdf(report) {
  const doc = await newDoc()
  const done = collect(doc)
  header(doc, 'ROI Score Calculator — estimate')

  const ctx = report.context || {}
  row(doc, 'Estimate ID', report.estimateId || '—')
  row(doc, 'Generated', fmtDate(report.generatedAt || new Date().toISOString()))
  row(doc, 'Site / fab', ctx.site || '—')
  row(doc, 'Department', ctx.department || '—')
  row(doc, 'Process', ctx.process || '—')
  row(doc, 'Machine', ctx.machine || '—')
  doc.moveDown(0.4)

  const o = report.output || {}
  doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold').text('Estimated impact (range)')
  doc.moveDown(0.4)
  row(doc, 'Annual savings', usdRange(o.annualSavings))
  row(doc, 'Monthly savings', usdRange(o.monthlySavings))
  row(doc, 'Sigenic score', `${o.score} / 100`)
  row(doc, 'Yield improvement', pctRange(o.yieldImprovement))
  row(doc, 'Scrap reduction', pctRange(o.scrapReduction))
  row(doc, 'Downtime reduction', pctRange(o.downtimeReduction))
  row(doc, 'Faster detection', pctRange(o.detectionSpeedImprovement))
  if (o.modelVersion) row(doc, 'Scoring model', o.modelVersion)

  if (Array.isArray(o.breakdown) && o.breakdown.length) {
    doc.moveDown(0.4)
    doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold').text('Monthly financial breakdown (upper bound)')
    doc.moveDown(0.4)
    for (const b of o.breakdown) {
      row(doc, b.label, usd(b.value))
    }
  }

  doc.moveDown(2)
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font('Helvetica')
    .text('Rule-based estimate driven by the active Sigenic scoring model. Validate with a pilot run before capacity planning.', 54, doc.y, { width: 487 })

  doc.end()
  return done
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso)
  }
}
