import type { Company, Department, Machine, Process, ScoringModel, Site } from './types'

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
