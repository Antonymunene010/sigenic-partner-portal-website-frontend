import { Field, NumberField } from './ui'
import type { DetectionKey } from '../lib/types'
import type { IssueValues } from '../lib/calculator'

/**
 * The shared issue checklist used by both the authenticated and public
 * calculators: one row per issue with severity / occurrence / detection inputs.
 * Presentational only — the parent owns the inputs map and the patch callback.
 */
export function IssueQuestionnaire({
  catalog,
  inputs,
  occurrenceOptions,
  detectionOptions,
  onPatch,
}: {
  catalog: { id: string; label: string }[]
  inputs: Record<string, IssueValues>
  occurrenceOptions: { id: string; value: number; label?: string | null }[]
  detectionOptions: { id: string; key: DetectionKey; label: string }[]
  onPatch: (id: string, patch: IssueValues) => void
}) {
  return (
    <div className="mt-5 space-y-3">
      <div className="stat-label">Issues</div>
      {catalog.map((issue) => {
        const v = inputs[issue.id] ?? {}
        return (
          <div key={issue.id} className="rounded-lg border border-line dark:border-line-dark p-3">
            <div className="text-sm font-medium mb-2">{issue.label}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <NumberField label="Severity" unit="pcs" value={v.severity} onChange={(n) => onPatch(issue.id, { severity: n })} />
              <Field label="Occurrence / yr">
                <select className="select" value={v.occurrence ?? ''} onChange={(e) => onPatch(issue.id, { occurrence: e.target.value === '' ? undefined : Number(e.target.value) })}>
                  <option value="">—</option>
                  {occurrenceOptions.map((o) => (
                    <option key={o.id} value={o.value}>{o.label ?? o.value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Detection">
                <select className="select" value={v.detection ?? ''} onChange={(e) => onPatch(issue.id, { detection: (e.target.value || undefined) as DetectionKey | undefined })}>
                  <option value="">—</option>
                  {detectionOptions.map((d) => (
                    <option key={d.id} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )
      })}
    </div>
  )
}
