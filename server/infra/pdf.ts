/**
 * Server-side PDF generation (PRD 6.5 "View invoices (PDF)" and 6.8
 * "Exportable report"). Uses pdfkit's built-in fonts so it needs no system
 * font packages inside the container. The pdfkit document is untyped here (no
 * bundled .d.ts), so the `doc` handle is treated as `any`.
 */

// Sigenic palette (PRD §11): near-black ink + gold accent.
const BRAND = '#0E0E10'
const ACCENT = '#C8A75B'
const MUTED = '#6b7280'

const usd = (n: number | null | undefined): string =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const num = (n: number | null | undefined, d = 1): string =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

async function newDoc(): Promise<any> {
  const { default: PDFDocument } = await import('pdfkit')
  return new PDFDocument({ size: 'A4', margin: 54 })
}

function collect(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
}

function header(doc: any, title: string): void {
  doc.fillColor(BRAND).fontSize(20).font('Helvetica-Bold').text('Sigenic', { continued: true })
  doc.fillColor(ACCENT).text(' /', { continued: true })
  doc.fillColor(MUTED).fontSize(11).font('Helvetica').text('  Partner Portal')
  doc.moveDown(0.3)
  doc.fillColor(BRAND).fontSize(15).font('Helvetica-Bold').text(title)
  doc.moveTo(54, doc.y + 4).lineTo(541, doc.y + 4).strokeColor('#e5e7eb').stroke()
  doc.moveDown(1)
}

function row(doc: any, label: string, value: unknown): void {
  const y = doc.y
  doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 54, y)
  doc.fillColor(BRAND).fontSize(10).font('Helvetica-Bold').text(String(value), 200, y)
  doc.moveDown(0.6)
}

/** Build an invoice PDF buffer. */
export async function invoicePdf(
  invoice: any,
  { company, billingContact, email }: { company?: string; billingContact?: string; email?: string } = {},
): Promise<Buffer> {
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

const DET_LABEL: Record<string, string> = { unable: 'Unable', partial: 'Partial', system: 'System' }
const TIER_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low', none: '—' }

/** Build a Risk Score & Yield Loss report PDF buffer (per-issue, PRD calculator_runs). */
export async function reportPdf(report: any): Promise<Buffer> {
  const doc = await newDoc()
  const done = collect(doc)
  header(doc, 'Risk Score & Yield Loss — estimate')

  const ctx = report.context || {}
  row(doc, 'Estimate ID', report.estimateId || '—')
  row(doc, 'Generated', fmtDate(report.generatedAt || new Date().toISOString()))
  row(doc, 'Site / fab', ctx.site || '—')
  row(doc, 'Department', ctx.department || '—')
  row(doc, 'Machine', ctx.machine || '—')
  row(doc, 'Technology', ctx.technology || '—')
  doc.moveDown(0.4)

  const o = report.output || {}
  doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold').text('Overall')
  doc.moveDown(0.4)
  row(doc, 'Overall risk score', `${num(o.overallRiskScore, 1)} / 15  (${TIER_LABEL[o.overallTier] ?? '—'})`)
  row(doc, 'Annual savings opportunity', usd(o.totalAnnualValueLoss))
  row(doc, 'Wafers at risk / yr', num(o.totalAnnualWaferLoss, 0))
  row(doc, 'Price / wafer', `${usd(o.pricePerWafer)}${o.priceSource === 'technology_average' ? ' (tech avg)' : ''}`)
  if (o.modelVersion) row(doc, 'Scoring model', o.modelVersion)

  const issues = Array.isArray(o.issues) ? o.issues : []
  if (issues.length) {
    doc.moveDown(0.5)
    doc.fillColor(BRAND).fontSize(12).font('Helvetica-Bold').text('Issues')
    doc.moveDown(0.3)
    const cols = { issue: 54, sev: 276, occ: 326, det: 372, risk: 452, band: 498 }
    let y = doc.y + 2
    doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold')
    doc.text('ISSUE', cols.issue, y)
    doc.text('SEV', cols.sev, y)
    doc.text('OCC', cols.occ, y)
    doc.text('DET', cols.det, y)
    doc.text('RISK', cols.risk, y)
    doc.text('BAND', cols.band, y)
    doc.moveTo(54, y + 12).lineTo(541, y + 12).strokeColor('#e5e7eb').stroke()
    y += 18
    for (const it of issues) {
      if (y > 760) {
        doc.addPage()
        y = 54
      }
      doc.font('Helvetica').fontSize(9).fillColor(BRAND).text(String(it.label ?? 'Issue'), cols.issue, y, { width: 210 })
      const labelBottom = doc.y
      doc.fillColor(MUTED)
      doc.text(it.severity ? num(it.severity, 0) : '—', cols.sev, y, { width: 44 })
      doc.text(it.occurrence ? num(it.occurrence, 2) : '—', cols.occ, y, { width: 40 })
      doc.text(it.detection ? DET_LABEL[it.detection] ?? it.detection : '—', cols.det, y, { width: 76 })
      doc.fillColor(BRAND).font('Helvetica-Bold').text(num(it.riskScore, 2), cols.risk, y, { width: 40 })
      doc.font('Helvetica').fillColor(MUTED).text(TIER_LABEL[it.tier] ?? '—', cols.band, y, { width: 43 })
      y = Math.max(labelBottom, y + 12) + 4
    }
  }

  doc.moveDown(2)
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Risk bands: 9–15 High · 4–8 Medium · 1–3 Low. Annual yield loss = Σ(severity × occurrence) × wafer price. Validate with a pilot before capacity planning.',
      54,
      doc.y,
      { width: 487 },
    )

  doc.end()
  return done
}

function fmtDate(iso: string | null | undefined): string {
  try {
    return new Date(iso as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso)
  }
}
