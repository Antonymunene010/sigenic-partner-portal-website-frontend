import { Download, ReceiptText } from 'lucide-react'
import { load } from '../lib/storage'
import type { Invoice } from '../lib/types'
import { seedInvoices } from '../lib/seed'
import { Badge } from '../components/Badge'
import { PageHeader } from '../components/PageHeader'
import { fmtDate, fmtUSD } from '../lib/format'
import { useAuth } from '../lib/auth'

export default function Billing() {
  const { user } = useAuth()
  const invoices = load<Invoice[]>('invoices', seedInvoices)
  const open = invoices.find((i) => i.status === 'open')
  const ytdPaid = invoices.filter((i) => i.status === 'paid').reduce((a, b) => a + b.amount, 0)
  const avg = Math.round(
    invoices.slice(0, 4).reduce((a, b) => a + b.amount, 0) / Math.min(4, invoices.length),
  )

  return (
    <div>
      <PageHeader
        eyebrow="Billing · account"
        title="Invoices & usage"
        description="All charges are net-30 against the master services agreement. Credits and refunds appear on the next invoice."
        actions={
          <button className="btn-outline">
            <Download size={14} /> Download statement
          </button>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="stat-label">Amount due</div>
          <div className="mt-2 text-[32px] font-semibold tracking-tightest num leading-none">
            {open ? fmtUSD(open.amount) : '—'}
          </div>
          {open && (
            <div className="mt-2 text-[12px] text-muted dark:text-muted-dark">
              Invoice <span className="font-mono">{open.id}</span> · due {fmtDate(open.periodEnd)}
            </div>
          )}
          {open && (
            <div className="mt-4 flex gap-2">
              <button className="btn-accent h-9 flex-1">Pay now</button>
              <button className="btn-outline h-9">View</button>
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="stat-label">Paid YTD</div>
          <div className="mt-2 text-[32px] font-semibold tracking-tightest num leading-none">{fmtUSD(ytdPaid)}</div>
          <div className="mt-2 text-[12px] text-muted dark:text-muted-dark">{invoices.filter((i) => i.status === 'paid').length} invoices</div>
        </div>
        <div className="card p-5">
          <div className="stat-label">Avg monthly run-rate</div>
          <div className="mt-2 text-[32px] font-semibold tracking-tightest num leading-none">{fmtUSD(avg)}</div>
          <div className="mt-2 text-[12px] text-muted dark:text-muted-dark">Trailing 4 months</div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="px-4 py-3 border-b border-line dark:border-line-dark flex items-center justify-between">
            <div className="text-[13px] font-medium flex items-center gap-2"><ReceiptText size={14} /> Invoices</div>
            <div className="text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">{invoices.length} total</div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Period</th>
                <th className="text-right">Amount</th>
                <th className="w-28">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="font-mono text-[12.5px]">{i.id}</td>
                  <td className="text-[12.5px] text-muted dark:text-muted-dark">
                    {fmtDate(i.periodStart)} — {fmtDate(i.periodEnd)}
                  </td>
                  <td className="text-right font-mono num text-[13px]">{fmtUSD(i.amount, { cents: true })}</td>
                  <td><Badge tone={i.status as any} dot>{i.status}</Badge></td>
                  <td className="text-right pr-3">
                    <button className="text-faint dark:text-faint-dark hover:text-ink dark:hover:text-ink-dark" aria-label="Download">
                      <Download size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="text-[13px] font-medium mb-3">Plan</div>
            <div className="text-[22px] font-semibold tracking-tight">APAC · Partner Plus</div>
            <div className="text-[12px] text-muted dark:text-muted-dark mt-1">Master agreement MSA-2025-APAC</div>
            <dl className="mt-4 text-[12.5px] space-y-2">
              <Row k="Billing cycle" v="Monthly · net 30" />
              <Row k="Seats" v="12 / 20" />
              <Row k="Telemetry volume" v="6.2M events / mo" />
              <Row k="Renewal" v={<span className="font-mono">2026-10-01</span>} />
            </dl>
          </div>

          <div className="card p-5">
            <div className="text-[13px] font-medium mb-3">Billing contact</div>
            <div className="text-[13px]">{user?.name}</div>
            <div className="text-[12px] text-muted dark:text-muted-dark">{user?.email}</div>
            <div className="mt-2 text-[11px] font-mono text-faint dark:text-faint-dark uppercase tracking-[0.1em]">
              {user?.company}
            </div>
            <button className="btn-outline mt-4 w-full h-9 text-[12px]">Update contact</button>
          </div>
        </aside>
      </section>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted dark:text-muted-dark">{k}</dt>
      <dd className="text-ink dark:text-ink-dark text-right">{v}</dd>
    </div>
  )
}
