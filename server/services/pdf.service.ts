import { invoicePdf, reportPdf } from '../infra/pdf'
import { isInternal, canSeeCompany } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

/** Render an invoice to PDF, enforcing company-scoped visibility for external users. */
export async function getInvoicePdf(store: Store, auth: AuthPayload, invoiceId: string): Promise<Buffer> {
  const invoice = await store.getOne('invoices', invoiceId)
  if (!invoice) throw notFound('Invoice not found.')
  if (!isInternal(auth) && !canSeeCompany(auth, invoice.companyId)) throw forbidden()
  const company = invoice.companyId ? await store.getOne('companies', invoice.companyId) : null
  return invoicePdf(
    { ...invoice, lineItems: invoice.lineItemsJson },
    { company: company?.companyName, billingContact: company?.billingContactName, email: company?.billingContactEmail },
  )
}

/** Render an ROI calculator estimate to PDF. */
export async function generateReportPdf(report: any): Promise<Buffer> {
  if (!report?.output) throw badRequest('Report payload is required.')
  return reportPdf(report)
}
