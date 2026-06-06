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
import { boolTone, MODEL_STATUS_TONE, DETECTION_LABEL } from '../../lib/constants'
import { fmtUSD } from '../../lib/format'
import { departmentOptions, processOptions, scoringModelOptions } from '../../lib/options'
import type { CalcIssue, Department, DetectionOption, Machine, OccurrenceOption, Process, ScoringModel, TechnologyPrice } from '../../lib/types'

// Master-data taxonomy and the scoring engine both feed the self-service calculator
// and are super-admin-only, so they live on one screen split by a chip rail rather
// than as two near-identical pages.
type Tab = 'departments' | 'processes' | 'machines' | 'models' | 'issues' | 'occurrence' | 'detection' | 'pricing'
const MASTER_TABS: Tab[] = ['departments', 'processes', 'machines']
const SCORING_TABS: Tab[] = ['models', 'issues', 'occurrence', 'detection', 'pricing']

const DETECTION_OPTIONS = (Object.keys(DETECTION_LABEL) as (keyof typeof DETECTION_LABEL)[]).map((k) => ({ value: k, label: DETECTION_LABEL[k] }))

export default function AdminCalculatorConfig() {
  const { user } = useAuth()
  const { departments, processes, machines, scoringModels, calculatorIssues, occurrenceOptions, detectionOptions, technologyPrices, refresh } = useData()
  const lookups = useLookups()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('departments')
  const canManage = can(user, 'manage_scoring')

  const deptOptions = departmentOptions(departments)
  const procOptions = processOptions(processes)
  const modelOptions = scoringModelOptions(scoringModels)
  const activeBadge = (a: boolean) => <Badge tone={boolTone(a)}>{a ? 'active' : 'inactive'}</Badge>

  const activate = async (id: string) => {
    try {
      await activateScoringModel(id)
      await refresh()
      toast.push('Model activated.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Activate failed.', 'error')
    }
  }

  const chip = (t: Tab) => (
    <button key={t} onClick={() => setTab(t)} className={`${chipClass(tab === t)} capitalize`}>
      {t}
    </button>
  )

  return (
    <div>
      <PageHeader eyebrow="Calculator config" title="Master data & scoring" description="The operational taxonomy (departments, processes, machines) and the risk-score engine (versioned models, the issue catalog and the occurrence / detection / wafer-price lookups) behind the self-service calculator. Super-admin only." />

      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {MASTER_TABS.map(chip)}
        <span className="w-px h-5 bg-line dark:bg-line-dark mx-1.5" aria-hidden />
        {SCORING_TABS.map(chip)}
      </div>

      {tab === 'departments' && (
        <CrudResource<Department>
          title="Departments"
          resource="departments"
          idPrefix="dep"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={departments}
          refresh={refresh}
          columns={[
            { key: 'name', header: 'Name', render: (d) => <span className="font-medium">{d.name}</span> },
            { key: 'code', header: 'Code', render: (d) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{d.code}</span> },
            { key: 'technology', header: 'Technology', render: (d) => <span className="text-muted dark:text-muted-dark">{d.technology ?? '—'}</span> },
            { key: 'active', header: 'Status', render: (d) => activeBadge(d.active) },
          ]}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'code', label: 'Code' },
            { key: 'technology', label: 'Technology (e.g. 200mm)', help: 'Drives the default per-wafer price in the calculator.' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'processes' && (
        <CrudResource<Process>
          title="Processes"
          resource="processes"
          idPrefix="proc"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={processes}
          refresh={refresh}
          columns={[
            { key: 'processName', header: 'Process', render: (p) => <span className="font-medium">{p.processName}</span> },
            { key: 'department', header: 'Department', sortAccessor: (p) => lookups.departmentName(p.departmentId), render: (p) => lookups.departmentName(p.departmentId) },
            { key: 'code', header: 'Code', sortAccessor: (p) => p.processCode, render: (p) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{p.processCode}</span> },
            { key: 'active', header: 'Status', render: (p) => activeBadge(p.active) },
          ]}
          fields={[
            { key: 'processName', label: 'Process name', required: true },
            { key: 'departmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'processCode', label: 'Code' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'machines' && (
        <CrudResource<Machine>
          title="Machines"
          resource="machines"
          idPrefix="mac"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={machines}
          refresh={refresh}
          columns={[
            { key: 'machineName', header: 'Machine', render: (m) => <div><div className="font-medium">{m.machineName}</div><div className="text-xs text-muted dark:text-muted-dark">{[m.vendor, m.model].filter(Boolean).join(' · ')}</div></div> },
            { key: 'department', header: 'Department', sortAccessor: (m) => lookups.departmentName(m.departmentId), render: (m) => lookups.departmentName(m.departmentId) },
            { key: 'category', header: 'Category', sortAccessor: (m) => m.machineCategory, render: (m) => <span className="text-muted dark:text-muted-dark">{m.machineCategory}</span> },
            { key: 'active', header: 'Status', render: (m) => activeBadge(m.active) },
          ]}
          fields={[
            { key: 'machineName', label: 'Machine name', required: true },
            { key: 'machineCode', label: 'Code' },
            { key: 'departmentId', label: 'Department', type: 'select', options: deptOptions, required: true },
            { key: 'processId', label: 'Process', type: 'select', options: procOptions },
            { key: 'machineCategory', label: 'Category' },
            { key: 'vendor', label: 'Vendor' },
            { key: 'model', label: 'Model' },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

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

      {tab === 'issues' && (
        <CrudResource<CalcIssue>
          title="Issue catalog"
          resource="calculator-issues"
          idPrefix="iss"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={calculatorIssues}
          refresh={refresh}
          columns={[
            { key: 'label', header: 'Issue', render: (r) => <span className="font-medium">{r.label}</span> },
            { key: 'department', header: 'Department', sortAccessor: (r) => lookups.departmentName(r.departmentId), render: (r) => <span className="text-muted dark:text-muted-dark">{lookups.departmentName(r.departmentId)}</span> },
            { key: 'model', header: 'Model', sortAccessor: (r) => lookups.scoringModelName(r.scoringModelId), render: (r) => <span className="text-muted dark:text-muted-dark">{lookups.scoringModelName(r.scoringModelId)}</span> },
            { key: 'defaults', header: 'Defaults', render: (r) => <span className="num text-xs text-muted dark:text-muted-dark">{[r.defaultSeverity ? `${r.defaultSeverity} pcs` : null, r.defaultOccurrence ? `${r.defaultOccurrence}/yr` : null, r.defaultDetection ? DETECTION_LABEL[r.defaultDetection] : null].filter(Boolean).join(' · ') || '—'}</span> },
            { key: 'sortOrder', header: 'Order', render: (r) => <span className="num">{r.sortOrder}</span> },
          ]}
          fields={[
            { key: 'scoringModelId', label: 'Model', type: 'select', options: modelOptions, required: true },
            { key: 'departmentId', label: 'Department / template', type: 'select', options: deptOptions, required: true },
            { key: 'label', label: 'Issue label', required: true, full: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'defaultSeverity', label: 'Default severity (pcs)', type: 'number' },
            { key: 'defaultOccurrence', label: 'Default occurrence / yr', type: 'number' },
            { key: 'defaultDetection', label: 'Default detection', type: 'select', options: DETECTION_OPTIONS },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'occurrence' && (
        <CrudResource<OccurrenceOption>
          title="Occurrence options"
          description="Events per year and their risk-score contribution (Section 2)."
          resource="occurrence-options"
          idPrefix="occ"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={occurrenceOptions}
          refresh={refresh}
          columns={[
            { key: 'value', header: 'Value / yr', render: (r) => <span className="num font-medium">{r.value}</span> },
            { key: 'score', header: 'Score', render: (r) => <span className="num">{r.score}</span> },
            { key: 'label', header: 'Label', render: (r) => <span className="text-muted dark:text-muted-dark">{r.label ?? '—'}</span> },
          ]}
          fields={[
            { key: 'value', label: 'Value (events / year)', type: 'number', required: true },
            { key: 'score', label: 'Score', type: 'number', required: true },
            { key: 'label', label: 'Label' },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'detection' && (
        <CrudResource<DetectionOption>
          title="Detection options"
          description="Detection capability and its risk-score contribution (Section 3)."
          resource="detection-options"
          idPrefix="det"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={detectionOptions}
          refresh={refresh}
          columns={[
            { key: 'label', header: 'Label', render: (r) => <span className="font-medium">{r.label}</span> },
            { key: 'key', header: 'Key', render: (r) => <span className="font-mono text-xs text-muted dark:text-muted-dark">{r.key}</span> },
            { key: 'score', header: 'Score', render: (r) => <span className="num">{r.score}</span> },
          ]}
          fields={[
            { key: 'key', label: 'Key', type: 'select', options: DETECTION_OPTIONS, required: true, help: 'Stable identifier referenced by issues.' },
            { key: 'label', label: 'Label', required: true, full: true },
            { key: 'score', label: 'Score', type: 'number', required: true },
            { key: 'sortOrder', label: 'Sort order', type: 'number', defaultValue: 0 },
            { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
          ]}
        />
      )}

      {tab === 'pricing' && (
        <CrudResource<TechnologyPrice>
          title="Technology prices"
          description="Per-wafer price band by technology. The average is the default wafer value when none is entered."
          resource="technology-prices"
          idPrefix="tp"
          canManage={canManage}
          inlineToggle={{ key: 'active' }}
          rows={technologyPrices}
          refresh={refresh}
          columns={[
            { key: 'technology', header: 'Technology', render: (r) => <span className="font-medium">{r.technology}</span> },
            { key: 'avgPrice', header: 'Average', sortAccessor: (r) => r.avgPrice, render: (r) => <span className="num font-medium">{fmtUSD(r.avgPrice)}</span> },
            { key: 'range', header: 'Min – Max', sortAccessor: (r) => r.minPrice, render: (r) => <span className="num text-muted dark:text-muted-dark">{fmtUSD(r.minPrice)} – {fmtUSD(r.maxPrice)}</span> },
            { key: 'currency', header: 'Currency', render: (r) => r.currency },
          ]}
          fields={[
            { key: 'technology', label: 'Technology (e.g. 200mm)', required: true },
            { key: 'label', label: 'Label' },
            { key: 'minPrice', label: 'Min price', type: 'number', required: true },
            { key: 'avgPrice', label: 'Average price (default)', type: 'number', required: true },
            { key: 'maxPrice', label: 'Max price', type: 'number', required: true },
            { key: 'currency', label: 'Currency', defaultValue: 'USD' },
          ]}
        />
      )}
    </div>
  )
}
