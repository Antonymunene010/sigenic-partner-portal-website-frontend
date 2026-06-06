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
import { MODEL_STATUS_TONE, DETECTION_LABEL } from '../../lib/constants'
import { fmtUSD } from '../../lib/format'
import { departmentOptions, scoringModelOptions } from '../../lib/options'
import type { CalcIssue, DetectionOption, OccurrenceOption, ScoringModel, TechnologyPrice } from '../../lib/types'

type Tab = 'models' | 'issues' | 'occurrence' | 'detection' | 'pricing'
const TABS: Tab[] = ['models', 'issues', 'occurrence', 'detection', 'pricing']

const DETECTION_OPTIONS = (Object.keys(DETECTION_LABEL) as (keyof typeof DETECTION_LABEL)[]).map((k) => ({ value: k, label: DETECTION_LABEL[k] }))

export default function AdminScoring() {
  const { user } = useAuth()
  const { scoringModels, calculatorIssues, occurrenceOptions, detectionOptions, technologyPrices, departments, refresh } = useData()
  const lookups = useLookups()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('models')
  const canManage = can(user, 'manage_scoring')

  const modelOptions = scoringModelOptions(scoringModels)
  const deptOptions = departmentOptions(departments)
  const modelName = (id?: string | null) => scoringModels.find((m) => m.id === id)?.versionName ?? '—'

  const activate = async (id: string) => {
    try {
      await activateScoringModel(id)
      await refresh()
      toast.push('Model activated.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Activate failed.', 'error')
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Scoring & Risk" title="Calculator configuration" description="The brain of the self-service calculator: versioned models, the per-template issue catalog and the Configuration lookups (occurrence, detection, wafer prices). Internal management only." />

      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {TABS.map((t) => (
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
            { key: 'model', header: 'Model', sortAccessor: (r) => modelName(r.scoringModelId), render: (r) => <span className="text-muted dark:text-muted-dark">{modelName(r.scoringModelId)}</span> },
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
