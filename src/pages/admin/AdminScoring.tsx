import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useData, useLookups } from '../../lib/data'
import { can } from '../../lib/permissions'
import { activateScoringModel } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { useToast, chipClass } from '../../components/ui'
import { METRIC_LABEL, METRIC_TYPES, MODEL_STATUS_TONE } from '../../lib/constants'
import { fmtUSD } from '../../lib/format'
import type { FinancialAssumption, ScoringModel, ScoringRule } from '../../lib/types'

type Tab = 'models' | 'rules' | 'assumptions'

export default function AdminScoring() {
  const { user } = useAuth()
  const { scoringModels, scoringRules, financialAssumptions, departments, processes, machines, companies, refresh } = useData()
  const lookups = useLookups()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('models')
  const canManage = can(user, 'manage_scoring')

  const modelOptions = scoringModels.map((m) => ({ value: m.id, label: m.versionName }))
  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }))
  const procOptions = processes.map((p) => ({ value: p.id, label: p.processName }))
  const macOptions = machines.map((m) => ({ value: m.id, label: m.machineName }))
  const coOptions = companies.map((c) => ({ value: c.id, label: c.companyName }))

  const activate = async (id: string) => {
    try {
      await activateScoringModel(id)
      await refresh()
      toast.push('Model activated.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Activate failed.', 'error')
    }
  }

  const ruleScope = (r: ScoringRule) =>
    r.machineId ? lookups.machineName(r.machineId) : r.processId ? lookups.processName(r.processId) : r.departmentId ? lookups.departmentName(r.departmentId) : 'Global'

  return (
    <div>
      <PageHeader eyebrow="Scoring & ROI" title="Scoring configuration" description="The brain of the self-service calculator: versioned models, per-metric rules and financial assumptions. Internal management only." />

      <div className="flex items-center gap-1 mb-5">
        {(['models', 'rules', 'assumptions'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`${chipClass(tab === t)} capitalize`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'models' && (
        <CrudResource<ScoringModel>
          title="Scoring models"
          resource="scoring-models"
          idPrefix="sm"
          canManage={canManage}
          rows={scoringModels}
          refresh={refresh}
          columns={[
            { key: 'versionName', header: 'Version', render: (m) => <span className="font-medium">{m.versionName}</span> },
            { key: 'status', header: 'Status', render: (m) => <Badge tone={MODEL_STATUS_TONE[m.status]}>{m.status}</Badge> },
            { key: 'effectiveFrom', header: 'Effective', render: (m) => <span className="text-muted dark:text-muted-dark">{m.effectiveFrom ?? '—'}</span> },
            {
              key: 'activate', header: '', className: 'text-right',
              render: (m) =>
                canManage && m.status !== 'active' ? (
                  <button className="btn-ghost text-xs" onClick={(e) => { e.stopPropagation(); activate(m.id) }}>
                    <CheckCircle2 size={13} /> Activate
                  </button>
                ) : null,
            },
          ]}
          fields={[
            { key: 'versionName', label: 'Version name', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }], defaultValue: 'draft' },
            { key: 'effectiveFrom', label: 'Effective from', type: 'date' },
          ]}
        />
      )}

      {tab === 'rules' && (
        <CrudResource<ScoringRule>
          title="Scoring rules"
          resource="scoring-rules"
          idPrefix="sr-rule"
          canManage={canManage}
          rows={scoringRules}
          refresh={refresh}
          columns={[
            { key: 'metricType', header: 'Metric', sortAccessor: (r) => METRIC_LABEL[r.metricType], render: (r) => <span className="font-medium">{METRIC_LABEL[r.metricType]}</span> },
            { key: 'scope', header: 'Scope', sortAccessor: (r) => ruleScope(r), render: (r) => <span className="text-muted dark:text-muted-dark">{ruleScope(r)}</span> },
            { key: 'range', header: 'Range', sortAccessor: (r) => r.minValue, render: (r) => <span className="num">{r.minValue}–{r.maxValue}%</span> },
            { key: 'weight', header: 'Weight', render: (r) => <span className="num">{r.weight}</span> },
          ]}
          fields={[
            { key: 'scoringModelId', label: 'Model', type: 'select', options: modelOptions, required: true },
            { key: 'metricType', label: 'Metric', type: 'select', options: METRIC_TYPES.map((m) => ({ value: m.value, label: m.label })), required: true },
            { key: 'departmentId', label: 'Department (optional)', type: 'select', options: deptOptions },
            { key: 'processId', label: 'Process (optional)', type: 'select', options: procOptions },
            { key: 'machineId', label: 'Machine (optional)', type: 'select', options: macOptions },
            { key: 'minValue', label: 'Min %', type: 'number', required: true },
            { key: 'maxValue', label: 'Max %', type: 'number', required: true },
            { key: 'weight', label: 'Weight', type: 'number', defaultValue: 1 },
            { key: 'defaultValue', label: 'Default %', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      )}

      {tab === 'assumptions' && (
        <CrudResource<FinancialAssumption>
          title="Financial assumptions"
          resource="financial-assumptions"
          idPrefix="fa"
          canManage={canManage}
          rows={financialAssumptions}
          refresh={refresh}
          columns={[
            { key: 'scope', header: 'Scope', sortAccessor: (a) => (a.companyId ? lookups.companyName(a.companyId) : 'Global'), render: (a) => <span className="font-medium">{a.companyId ? lookups.companyName(a.companyId) : 'Global'}</span> },
            { key: 'cpw', header: 'Cost / wafer', sortAccessor: (a) => a.costPerWaferDefault, render: (a) => <span className="num">{fmtUSD(a.costPerWaferDefault)}</span> },
            { key: 'vol', header: 'Monthly volume', sortAccessor: (a) => a.monthlyVolumeDefault, render: (a) => <span className="num">{a.monthlyVolumeDefault.toLocaleString()}</span> },
            { key: 'currency', header: 'Currency', render: (a) => a.currency },
          ]}
          fields={[
            { key: 'scoringModelId', label: 'Model', type: 'select', options: modelOptions, required: true },
            { key: 'companyId', label: 'Company (blank = global)', type: 'select', options: coOptions },
            { key: 'costPerWaferDefault', label: 'Cost per wafer', type: 'number', required: true },
            { key: 'excursionCostDefault', label: 'Excursion cost', type: 'number', required: true },
            { key: 'monthlyVolumeDefault', label: 'Monthly volume', type: 'number', required: true },
            { key: 'laborCostDefault', label: 'Labor cost / hr', type: 'number' },
            { key: 'currency', label: 'Currency', defaultValue: 'USD' },
          ]}
        />
      )}
    </div>
  )
}
