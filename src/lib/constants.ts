import type {
  AudienceType,
  CompanyType,
  MetricType,
  ModelStatus,
  OnboardingStatus,
  OrgStatus,
  OwnerTeam,
  RequestSource,
  RequestStatus,
  RequestType,
  Urgency,
  Visibility,
} from './types'

/** Badge tones map to Badge.tsx color variants. */
export type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info'

export const REQUEST_TYPES: { value: RequestType; label: string; owner: OwnerTeam; blurb: string }[] = [
  { value: 'support', label: 'Support', owner: 'support', blurb: 'A technical issue routed to Zendesk.' },
  { value: 'demo', label: 'Demo', owner: 'sales', blurb: 'Request a product walkthrough.' },
  { value: 'consultation', label: 'Consultation', owner: 'sales', blurb: 'Scope a pilot or ROI review.' },
  { value: 'onboarding', label: 'Onboarding', owner: 'ops', blurb: 'Kickoff, training or access setup.' },
  { value: 'feature_request', label: 'Feature request', owner: 'product', blurb: 'Suggest a product improvement.' },
]

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = Object.fromEntries(
  REQUEST_TYPES.map((r) => [r.value, r.label]),
) as Record<RequestType, string>

export const URGENCIES: { value: Urgency; label: string; tone: Tone }[] = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'info' },
  { value: 'high', label: 'High', tone: 'danger' },
]

export const URGENCY_TONE: Record<Urgency, Tone> = Object.fromEntries(
  URGENCIES.map((u) => [u.value, u.tone]),
) as Record<Urgency, Tone>

export const REQUEST_STATUSES: { value: RequestStatus; label: string; tone: Tone }[] = [
  { value: 'new', label: 'New', tone: 'accent' },
  { value: 'submitted', label: 'Submitted', tone: 'info' },
  { value: 'in_review', label: 'In review', tone: 'warn' },
  { value: 'routed', label: 'Routed', tone: 'info' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
]

export const REQUEST_STATUS_TONE: Record<RequestStatus, Tone> = Object.fromEntries(
  REQUEST_STATUSES.map((s) => [s.value, s.tone]),
) as Record<RequestStatus, Tone>

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = Object.fromEntries(
  REQUEST_STATUSES.map((s) => [s.value, s.label]),
) as Record<RequestStatus, string>

export const OWNER_TEAMS: { value: OwnerTeam; label: string }[] = [
  { value: 'support', label: 'Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'ops', label: 'Ops' },
  { value: 'product', label: 'Product' },
]

export const REQUEST_SOURCE_LABEL: Record<RequestSource, string> = {
  landing_page: 'Landing page',
  portal_form: 'Portal form',
  calculator_cta: 'Calculator CTA',
  dashboard: 'Dashboard',
}

export const METRIC_TYPES: { value: MetricType; label: string; unit: string }[] = [
  { value: 'yield_improvement', label: 'Yield improvement', unit: '%' },
  { value: 'scrap_reduction', label: 'Scrap reduction', unit: '%' },
  { value: 'downtime_reduction', label: 'Downtime reduction', unit: '%' },
  { value: 'detection_speed_improvement', label: 'Detection speed-up', unit: '%' },
]

export const METRIC_LABEL: Record<MetricType, string> = Object.fromEntries(
  METRIC_TYPES.map((m) => [m.value, m.label]),
) as Record<MetricType, string>

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  sigenic: 'Sigenic (internal)',
  distributor: 'Distributor',
  customer: 'Customer',
}

export const ORG_STATUS_TONE: Record<OrgStatus, Tone> = {
  active: 'success',
  inactive: 'neutral',
  prospect: 'warn',
}

export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
  not_started: 'Not started',
  invited: 'Invited',
  in_progress: 'In progress',
  fully_onboarded: 'Fully onboarded',
}

export const AUDIENCE_TYPES: { value: AudienceType; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'distributor', label: 'Distributors' },
  { value: 'customer', label: 'Customers' },
  { value: 'internal', label: 'Internal' },
]

export const AUDIENCE_LABEL: Record<AudienceType, string> = Object.fromEntries(
  AUDIENCE_TYPES.map((a) => [a.value, a.label]),
) as Record<AudienceType, string>

export const AUDIENCE_TONE: Record<AudienceType, Tone> = {
  all: 'accent',
  distributor: 'info',
  customer: 'success',
  internal: 'neutral',
}

export const MODEL_STATUS_TONE: Record<ModelStatus, Tone> = {
  draft: 'warn',
  active: 'success',
  archived: 'neutral',
}

export const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'partners', label: 'Partners only' },
  { value: 'internal', label: 'Internal' },
]

export const VISIBILITY_LABEL: Record<Visibility, string> = Object.fromEntries(
  VISIBILITY_OPTIONS.map((v) => [v.value, v.label]),
) as Record<Visibility, string>

export const KB_CATEGORIES = ['FAQs', 'Troubleshooting', 'Best Practices', 'Known Issues', 'SOPs'] as const

export const INVOICE_STATUS_TONE: Record<string, Tone> = {
  paid: 'success',
  open: 'info',
  overdue: 'danger',
}

export const USER_STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  invited: 'warn',
  inactive: 'neutral',
}

/** Tone for a boolean active/enabled flag. */
export const boolTone = (on: boolean): Tone => (on ? 'success' : 'neutral')
