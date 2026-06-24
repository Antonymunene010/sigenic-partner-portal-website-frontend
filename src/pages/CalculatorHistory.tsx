import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData, useLookups } from '../lib/data'
import { isCompanyAdmin } from '../lib/permissions'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { DescRow } from '../components/DescRow'
import { RunResultSummary, runColumns } from '../components/RunResultSummary'
import { Spinner, EmptyState } from '../components/ui'
import { fmtDateTime } from '../lib/format'
import { runSubmitterName, runSubmitterEmail } from '../lib/calculatorRun'
import type { CalculatorRun } from '../lib/types'

const mailto = (email: string | null) =>
  email ? (
    <a href={`mailto:${email}`} className="hover:text-accent-ink hover:underline">
      {email}
    </a>
  ) : (
    '—'
  )

/**
 * External calculator-submission history (client feedback 2026-06): company admins
 * see every run submitted by their company, plain users only their own. The scoping
 * happens server-side in hydrate — this page just renders whatever arrived.
 */
export default function CalculatorHistory() {
  const { user } = useAuth()
  const { calculatorRuns, company, ready } = useData()
  const { userName, userEmail, departmentName, machineName } = useLookups()
  const [selected, setSelected] = useState<CalculatorRun | null>(null)
  const companyAdmin = isCompanyAdmin(user)

  if (!ready) return <Spinner />

  const submitterName = (r: CalculatorRun) => runSubmitterName(r, userName)
  const submitterEmail = (r: CalculatorRun) => runSubmitterEmail(r, userEmail)

  const whoColumn: Column<CalculatorRun> = {
    key: 'who',
    header: 'Submitted by',
    sortAccessor: (r) => submitterName(r).toLowerCase(),
    render: (r) => {
      const email = submitterEmail(r)
      return (
        <div className="min-w-0">
          <div className="font-medium truncate">{submitterName(r)}</div>
          {email && <div className="text-xs text-muted dark:text-muted-dark truncate">{email}</div>}
        </div>
      )
    },
  }
  const shared = runColumns({ departmentName, machineName })
  const columns = companyAdmin ? [whoColumn, ...shared] : shared

  return (
    <div>
      <PageHeader
        eyebrow={company?.companyName ?? 'Risk calculator'}
        title="Calculator history"
        description={
          companyAdmin
            ? 'Every risk-calculator submission from your company — open a row for the full breakdown.'
            : 'Your submitted risk-calculator runs — open a row for the full breakdown.'
        }
        actions={
          <Link to="/app/calculator" className="btn-accent">
            <Calculator size={15} /> Run calculator
          </Link>
        }
      />

      <DataTable
        columns={columns}
        rows={calculatorRuns}
        onRowClick={(r) => setSelected(r)}
        empty={
          <EmptyState
            title="No submissions yet"
            hint="Run the risk calculator and submit the assessment — it will show up here."
            action={<Link to="/app/calculator" className="btn-outline">Run calculator</Link>}
          />
        }
        defaultSort={{ key: 'when', dir: 'desc' }}
      />

      <Modal open={!!selected} onClose={() => setSelected(null)} wide title="Calculator submission">
        {selected && (
          <>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-5">
              {companyAdmin && <DescRow k="Submitted by" v={submitterName(selected)} />}
              {companyAdmin && <DescRow k="Email" v={mailto(submitterEmail(selected))} />}
              <DescRow k="Department" v={departmentName(selected.departmentId)} />
              <DescRow k="Machine" v={selected.machineId ? machineName(selected.machineId) : '—'} />
              <DescRow k="Technology" v={selected.technology ?? '—'} />
              <DescRow k="Submitted at" v={fmtDateTime(selected.submittedAt ?? selected.createdAt)} />
            </dl>
            <RunResultSummary run={selected} />
          </>
        )}
      </Modal>
    </div>
  )
}
