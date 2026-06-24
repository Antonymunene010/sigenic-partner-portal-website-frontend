import type { Company, Department, Machine, Process, RequestDepartment, RequestProcess, ScoringModel, Site } from './types'

export interface SelectOption {
  value: string
  label: string
}

/**
 * Map hydrate-bundle entities to {value,label} select options. Deduplicates the
 * `items.map(x => ({ value: x.id, label: x.<name> }))` pattern that recurred across
 * the admin forms.
 */
export const departmentOptions = (items: Department[]): SelectOption[] => items.map((d) => ({ value: d.id, label: d.name }))
export const processOptions = (items: Process[]): SelectOption[] => items.map((p) => ({ value: p.id, label: p.processName }))
export const machineOptions = (items: Machine[]): SelectOption[] => items.map((m) => ({ value: m.id, label: m.machineName }))
export const companyOptions = (items: Company[]): SelectOption[] => items.map((c) => ({ value: c.id, label: c.companyName }))
export const siteOptions = (items: Site[]): SelectOption[] => items.map((s) => ({ value: s.id, label: s.siteName }))
export const scoringModelOptions = (items: ScoringModel[]): SelectOption[] => items.map((m) => ({ value: m.id, label: m.versionName }))
// Request taxonomy (decoupled from the calculator master data above).
export const requestDepartmentOptions = (items: RequestDepartment[]): SelectOption[] => items.map((d) => ({ value: d.id, label: d.name }))
export const requestProcessOptions = (items: RequestProcess[]): SelectOption[] => items.map((p) => ({ value: p.id, label: p.processName }))

/**
 * Derive a human-readable, reasonably-unique company code from the name so admins
 * never hand-enter it (client feedback 2026-06). Shape: up to 6 alnum chars from
 * the name + a 4-char random suffix, e.g. "ACME-7F3K". The server column is UNIQUE;
 * the random suffix makes a collision on resubmit practically nil.
 */
export function generateCompanyCode(companyName: string): string {
  const base = companyName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'CO'
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${suffix}`
}
