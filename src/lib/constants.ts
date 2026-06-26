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

// Fixed industry dropdown for the company form — a curated list instead of free text,
// stored as the label string in companies.industry (client feedback 2026-06).
export const INDUSTRY_OPTIONS = [
  'Semiconductor',
  'Electronics / EMS',
  'Medical Device / Life Science',
  'Automotive / EV',
  'Aerospace / Defense',
  'Industrial Automation',
  'Research / University / Lab',
  'Distributor / Channel Partner',
  'System Integrator / Consultant',
  'Other',
] as const

// ISO 3166-1 countries and territories, alphabetical. Stored as the label string in
// companies.country (client feedback 2026-06: replace free-text with a fixed list so
// the same country isn't entered three ways). Same pattern as INDUSTRY_OPTIONS.
export const COUNTRY_OPTIONS = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo (Brazzaville)', 'Congo (Kinshasa)',
  'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
  'Lithuania', 'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname',
  'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
] as const

// Single source for the company lifecycle (client feedback 2026-06); the tone/label
// Records derive from it, matching the REQUEST_STATUSES pattern above.
export const ORG_STATUSES: { value: OrgStatus; label: string; tone: Tone }[] = [
  { value: 'pending_invite', label: 'Pending invite', tone: 'warn' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'suspended', label: 'Suspended', tone: 'danger' },
  { value: 'inactive', label: 'Inactive', tone: 'neutral' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
]

export const ORG_STATUS_TONE: Record<OrgStatus, Tone> = Object.fromEntries(
  ORG_STATUSES.map((s) => [s.value, s.tone]),
) as Record<OrgStatus, Tone>

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = Object.fromEntries(
  ORG_STATUSES.map((s) => [s.value, s.label]),
) as Record<OrgStatus, string>

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
  // Self-service sign-up states (client feedback 2026-06).
  pending: 'warn',
  rejected: 'danger',
}

// Friendly labels for the user lifecycle — the raw status value is fine for the
// active/invited/inactive set, but the sign-up states read better spelled out.
export const USER_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  invited: 'Invited',
  inactive: 'Inactive',
  pending: 'Pending approval',
  rejected: 'Rejected',
}

/** Tone for a boolean active/enabled flag. */
export const boolTone = (on: boolean): Tone => (on ? 'success' : 'neutral')
