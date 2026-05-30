import { useState } from 'react'
import { Download, Wallet, CheckCircle2, CalendarClock } from 'lucide-react'
import { useData } from '../lib/data'
import { downloadInvoicePdf } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Card, StatCard, Spinner, EmptyState, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { DescRow } from '../components/DescRow'
import { fmtUSD, fmtDate } from '../lib/format'
import { INVOICE_STATUS_TONE } from '../lib/constants'
import type { Invoice } from '../lib/types'

export default function Billing() {
  const { invoices, company, ready } = useData()
  const { push } = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)

  if (!ready) return <Spinner />

  const amountDue = invoices.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0)
  const thisYear = new Date().getFullYear()
  const paidThisYear = invoices
    .filter((i) => i.status === 'paid' && i.issuedAt && new Date(i.issuedAt).getFullYear() === thisYear)
    .reduce((sum, i) => sum + i.amount, 0)

  async function handleDownload(id: string) {
    setDownloading(id)
    try {
      await downloadInvoicePdf(id)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not download invoice', 'error')
    } finally {
      setDownloading(null)
    }
  }

  const columns: Column<Invoice>[] = [
    { key: 'id', header: 'Invoice', render: (i) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{i.id}</span> },
    {
      key: 'period',
      header: 'Period',
      render: (i) => (
        <span>{i.periodStart ? fmtDate(i.periodStart) : '—'} – {i.periodEnd ? fmtDate(i.periodEnd) : '—'}</span>
      ),
    },
    { key: 'amount', header: 'Amount', render: (i) => <span className="font-medium">{fmtUSD(i.amount)}</span> },
    { key: 'status', header: 'Status', render: (i) => <Badge tone={INVOICE_STATUS_TONE[i.status]} dot>{i.status}</Badge> },
    {
      key: 'download',
      header: '',
      className: 'text-right',
      render: (i) => (
        <button
          className="btn-ghost text-xs"
          disabled={downloading === i.id}
          onClick={(e) => {
            e.stopPropagation()
            void handleDownload(i.id)
          }}
        >
          <Download size={14} /> {downloading === i.id ? 'Downloading…' : 'Download'}
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader eyebrow="Billing" title="Invoices & plan" description="Review balances, download invoices and check your subscription details." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Amount due" value={fmtUSD(amountDue)} accent icon={<Wallet size={15} />} />
        <StatCard label="Paid this year" value={fmtUSD(paidThisYear)} icon={<CheckCircle2 size={15} />} />
        <StatCard
          label="Next renewal"
          value={company?.renewalDate ? fmtDate(company.renewalDate) : '—'}
          icon={<CalendarClock size={15} />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card title="Invoices" className="lg:col-span-2" padded={false}>
          {invoices.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No invoices yet" hint="Invoices will appear here once issued." />
            </div>
          ) : (
            <DataTable columns={columns} rows={invoices} />
          )}
        </Card>

        <Card title="Plan & subscription">
          <dl className="space-y-2.5 text-sm">
            <DescRow k="Service tier" v={company?.serviceTier ?? '—'} />
            <DescRow k="Subscription" v={company?.subscriptionType ?? '—'} />
            <DescRow k="Trial" v={company?.trial ? <Badge tone="accent">Trial</Badge> : 'No'} />
            <DescRow k="Contract start" v={company?.contractStart ? fmtDate(company.contractStart) : '—'} />
            <DescRow k="Renewal date" v={company?.renewalDate ? fmtDate(company.renewalDate) : '—'} />
            <DescRow k="Billing contact" v={company?.billingContactName ?? '—'} />
            <DescRow k="Billing email" v={company?.billingContactEmail ?? '—'} />
          </dl>
        </Card>
      </div>
    </div>
  )
}
