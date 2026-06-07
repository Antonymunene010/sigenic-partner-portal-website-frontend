import type {
  AudienceType,
  CompanyType,
  DetectionKey,
  ModelStatus,
  OnboardingStatus,
  OrgStatus,
  OwnerTeam,
  RequestSource,
  RequestStatus,
  RiskTier,
  Urgency,
  Visibility,
} from './types'

/** Badge tones map to Badge.tsx color variants. */
export type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info'

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
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'pending', label: 'Pending', tone: 'warn' },
  { value: 'hold', label: 'On hold', tone: 'neutral' },
  { value: 'solved', label: 'Solved', tone: 'success' },
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

// Risk bands for the calculator (PRD: 9–15 High, 4–8 Medium, 1–3 Low).
// RISK_TIER_LABEL / RISK_TIER_RANGE / RISK_TIER_GUIDANCE live in shared/calc.ts so
// the server (admin emails) and the client render off one source of truth; only the
// UI-specific tone (Badge color) lives here.
export { RISK_TIER_LABEL, RISK_TIER_RANGE, RISK_TIER_GUIDANCE } from '../../shared/calc'
import { RISK_TIER_LABEL as TIER_LABEL, RISK_TIER_RANGE as TIER_RANGE } from '../../shared/calc'

export const RISK_TIER_TONE: Record<RiskTier, Tone> = {
  high: 'danger',
  medium: 'warn',
  low: 'success',
  none: 'neutral',
}

export const RISK_TIERS: { value: RiskTier; label: string; tone: Tone; range: string }[] = (
  ['high', 'medium', 'low', 'none'] as RiskTier[]
).map((value) => ({ value, label: TIER_LABEL[value], tone: RISK_TIER_TONE[value], range: TIER_RANGE[value] }))

// Fallback detection labels (the authoritative list comes from detection_options).
export const DETECTION_LABEL: Record<DetectionKey, string> = {
  unable: 'Unable to Detect',
  partial: 'Able to detect but not integrated to system',
  system: 'Able to detect by system',
}

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
