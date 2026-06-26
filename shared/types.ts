/**
 * Shared data contract — the single source of truth for the camelCase shapes
 * returned by the Node API (server rowToObj) and consumed by the React frontend.
 * Imported by both sides via shared/. Keep in sync with server/db/schema.ts.
 */

/* ---------- enums ---------- */
export type CompanyType = 'sigenic' | 'distributor' | 'customer'
// Company lifecycle (client feedback 2026-06): a company starts at pending_invite
// when its primary admin is invited, flips to active once that admin accepts (sets
// their first password), and can later be suspended/inactivated/archived.
export type OrgStatus = 'pending_invite' | 'active' | 'suspended' | 'inactive' | 'archived'
// Onboarding lifecycle (client feedback 2026-06): system-tracked per-company progress
// from "Not Started" (created, no invite yet) → "Invited" (primary admin emailed)
// → "Accepted" (that admin set their first password) → "Profile Completed" (country,
// website + billing contact filled) → "Live" (at least one non-admin user activated).
// Auto-advanced by server/services/onboarding.recompute on every relevant mutation.
export type OnboardingStatus = 'not_started' | 'invited' | 'accepted' | 'profile_completed' | 'live'

export type Role =
  | 'super_admin'
  | 'admin'
  | 'support_engineer'
  | 'distributor_admin'
  | 'distributor_user'
  | 'customer_admin'
  | 'customer_user'
export type UserType = 'internal' | 'distributor' | 'customer'
// User lifecycle. `invited`: an admin created the account, awaiting first password.
// `pending`/`rejected` (client feedback 2026-06): self-service sign-up — a user
// registers themselves into pending, an admin approves (→ invited, which emails the
// set-password link) or rejects (→ rejected, kept for the record).
export type UserStatus = 'active' | 'inactive' | 'invited' | 'pending' | 'rejected'

/** Detection capability for a risk issue → fixed score (see detection_options). */
export type DetectionKey = 'unable' | 'partial' | 'system'
/** Risk band for an issue / overall (PRD calculator: 9–15 high, 4–8 medium, 1–3 low). */
export type RiskTier = 'high' | 'medium' | 'low' | 'none'
export type ModelStatus = 'draft' | 'active' | 'archived'

export type Urgency = 'low' | 'medium' | 'high'
export type RequestStatus = 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed'
export type RequestSource = 'landing_page' | 'portal_form' | 'calculator_cta' | 'dashboard'
export type OwnerTeam = 'support' | 'sales' | 'ops' | 'product'

export type AudienceType = 'all' | 'distributor' | 'customer' | 'internal'
export type SourceType = 'zendesk' | 'notion' | 'portal'
export type InvoiceStatus = 'paid' | 'open' | 'overdue'
export type StoryStatus = 'draft' | 'published'
export type Visibility = 'public' | 'partners' | 'internal'

/* ---------- shared shapes ---------- */
export interface Metric {
  label: string
  value: string
}
export interface LineItem {
  description: string
  amount: number
}
export interface OnboardingMilestone {
  key: string
  label: string
  done: boolean
  completedAt?: string
}
export type CompanyPermissions = Partial<Record<'calculator' | 'case_studies' | 'service_requests' | 'knowledge_base' | 'billing', boolean>>

/* ---------- entities ---------- */
export interface Company {
  id: string
  companyName: string
  companyCode?: string
  companyType: CompanyType
  parentCompanyId?: string | null
  status: OrgStatus
  industry?: string | null
  country?: string | null
  website?: string | null
  zendeskOrgId?: string | null
  billingContactName?: string | null
  billingContactEmail?: string | null
  onboardingStatus: OnboardingStatus
  onboardingMilestones: OnboardingMilestone[]
  serviceTier?: string | null
  subscriptionType?: string | null
  trial: boolean
  contractStart?: string | null
  renewalDate?: string | null
  permissions: CompanyPermissions
  createdAt: string
  updatedAt: string
}

export interface Site {
  id: string
  companyId: string
  siteName: string
  siteCode?: string
  location?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  companyId?: string | null
  siteId?: string | null
  fullName: string
  email: string
  userType: UserType
  role: Role
  avatar?: string | null
  status: UserStatus
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
  // joined for convenience
  companyName?: string
  companyType?: CompanyType
}

export interface Department {
  id: string
  name: string
  code?: string
  description?: string
  /** Wafer technology (e.g. '200mm' / '300mm') — drives the default wafer price. */
  technology?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Process {
  id: string
  departmentId: string
  processName: string
  processCode?: string
  description?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Machine {
  id: string
  departmentId: string
  processId?: string | null
  machineName: string
  machineCode?: string
  machineCategory?: string
  vendor?: string
  model?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ScoringModel {
  id: string
  versionName: string
  description?: string
  status: ModelStatus
  effectiveFrom?: string | null
  effectiveTo?: string | null
  createdBy?: string
  createdAt: string
  updatedAt: string
}

/**
 * A configurable risk issue in the calculator questionnaire (one row per issue,
 * scoped to a department/template within a scoring model). Mirrors the Excel
 * "Risk Score & Yield Loss Simulator" issue rows. Defaults pre-fill the form.
 */
export interface CalcIssue {
  id: string
  scoringModelId: string
  departmentId: string
  label: string
  description?: string | null
  /** Section 1 (severity): pcs of affected wafers per occurrence. */
  defaultSeverity?: number | null
  /** Section 2 (occurrence): events per year. */
  defaultOccurrence?: number | null
  /** Section 3 (detection): default detection capability. */
  defaultDetection?: DetectionKey | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Configuration: occurrence option (per year) → risk-score contribution. */
export interface OccurrenceOption {
  id: string
  value: number
  score: number
  label?: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Configuration: detection level → risk-score contribution. */
export interface DetectionOption {
  id: string
  key: DetectionKey
  label: string
  score: number
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Configuration: wafer technology → price band (avg is the default per-wafer value). */
export interface TechnologyPrice {
  id: string
  technology: string
  label?: string | null
  minPrice: number
  avgPrice: number
  maxPrice: number
  currency: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** One issue's inputs in a calculation request. */
export interface IssueInput {
  issueId?: string
  label?: string
  severity?: number
  occurrence?: number
  detection?: DetectionKey
}

/** One issue's computed risk breakdown + annual yield loss. */
export interface IssueResult {
  issueId: string | null
  label: string
  severity: number
  occurrence: number
  detection: DetectionKey | null
  severityScore: number
  occurrenceScore: number
  detectionScore: number
  riskScore: number
  tier: RiskTier
  annualWaferLoss: number
  annualValueLoss: number
}

/**
 * Full calculator output: per-issue risk scores + tiers and the aggregate annual
 * yield loss (the "savings opportunity" headline). Replaces the old ROI model.
 */
export interface RiskResult {
  modelId: string | null
  modelVersion: string | null
  departmentId: string | null
  technology: string | null
  pricePerWafer: number
  priceSource: 'input' | 'technology_average' | 'unavailable'
  currency: string
  issues: IssueResult[]
  totalAnnualWaferLoss: number
  totalAnnualValueLoss: number
  overallRiskScore: number
  overallTier: RiskTier
  tierCounts: { high: number; medium: number; low: number }
  limited?: boolean
}

/** Trimmed result for the unauthenticated teaser — risk band + headline loss only. */
export type LimitedRiskResult = Pick<
  RiskResult,
  'modelVersion' | 'departmentId' | 'technology' | 'overallRiskScore' | 'overallTier' | 'tierCounts' | 'totalAnnualValueLoss' | 'currency'
> & { limited: true }

/** Metadata served to the public calculator (no wafer prices — loss is computed server-side). */
export interface PublicCalcConfig {
  model: { id: string; versionName: string } | null
  departments: { id: string; name: string; technology?: string | null }[]
  issues: {
    id: string
    departmentId: string
    label: string
    defaultSeverity?: number | null
    defaultOccurrence?: number | null
    defaultDetection?: DetectionKey | null
    sortOrder: number
  }[]
  occurrenceOptions: OccurrenceOption[]
  detectionOptions: DetectionOption[]
}

export interface CalcSelection {
  companyId?: string
  siteId?: string
  departmentId?: string
  machineId?: string
  /** Optional override for price per wafer; when omitted the technology average is used. */
  waferValue?: number
  issues?: IssueInput[]
}

export interface CalculatorRun {
  id: string
  companyId?: string | null
  siteId?: string | null
  userId?: string | null
  runType: 'public' | 'partner' | 'distributor' | 'internal'
  scoringModelId?: string | null
  departmentId?: string | null
  machineId?: string | null
  technology?: string | null
  waferValue?: number | null
  priceSource?: string | null
  overallRiskScore?: number | null
  overallTier?: RiskTier | null
  totalAnnualWaferLoss?: number | null
  totalAnnualValueLoss?: number | null
  inputsJson?: IssueInput[] | null
  outputSummaryJson?: RiskResult | null
  /** Wizard Step 1 client identity — entered by the submitter (auth users default to their company). */
  clientName?: string | null
  /** Public-submit only: how to follow up. Authenticated runs leave these blank — userId is the lookup key. */
  contactName?: string | null
  contactEmail?: string | null
  /** Wizard Step 3 additional information — free-text, optional. */
  preventiveMeasures?: string | null
  costsIncurred?: string | null
  /** Stamp set when the user clicks "Submit and Send Email" (mirrors createdAt for now, but explicit). */
  submittedAt?: string | null
  createdAt: string
}

/** Fields filled on Wizard Step 3 before the user submits ("Submit and Send Email"). */
export interface CalcAdditionalInfo {
  preventiveMeasures?: string
  costsIncurred?: string
}

/** Public-submit contact card (Step 3) — required so admins can follow up. */
export interface CalcContact {
  clientName: string
  contactName?: string
  contactEmail: string
  companyName?: string
}

/** Authenticated wizard submission. */
export interface CalcSubmitRequest {
  selection: CalcSelection
  additional?: CalcAdditionalInfo
  clientName?: string
  modelId?: string
}

/** Public wizard submission — adds a required contact card. */
export interface PublicCalcSubmitRequest {
  selection: CalcSelection
  additional?: CalcAdditionalInfo
  contact: CalcContact
}

/* ---------- request-form taxonomy (super-admin configurable, decoupled from the calculator master data) ---------- */
/** A configurable request type. `slug` is the stable value stored on service_requests. */
export interface RequestTypeDef {
  id: string
  slug: string
  label: string
  ownerTeam: OwnerTeam
  blurb?: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RequestDepartment {
  id: string
  name: string
  code?: string | null
  description?: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RequestProcess {
  id: string
  requestDepartmentId: string
  processName: string
  processCode?: string | null
  description?: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RequestMachine {
  id: string
  requestDepartmentId: string
  requestProcessId?: string | null
  machineName: string
  machineCode?: string | null
  machineCategory?: string | null
  vendor?: string | null
  model?: string | null
  sortOrder: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceRequestMessage {
  id: string
  author: string
  authorRole: 'you' | 'agent' | 'system'
  body: string
  createdAt: string
  zendeskCommentId?: string
}

export interface ServiceRequest {
  id: string
  companyId?: string | null
  siteId?: string | null
  userId?: string | null
  /** Configurable request-type slug (validated against request_types; see RequestTypeDef). */
  requestType: string
  title: string
  description?: string
  departmentId?: string | null
  processId?: string | null
  machineId?: string | null
  urgency: Urgency
  status: RequestStatus
  source: RequestSource
  ownerTeam: OwnerTeam
  linkedCalculatorRunId?: string | null
  zendeskTicketId?: string | null
  contactName?: string | null
  contactEmail?: string | null
  interestType?: string | null
  messages: ServiceRequestMessage[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeArticle {
  id: string
  sourceType: SourceType
  sourceRefId?: string | null
  slug?: string
  title: string
  summary?: string
  category?: string
  tagsJson: string[]
  body?: string
  coverImageId?: string | null
  active: boolean
  featured: boolean
  audienceType: AudienceType
  lastReviewedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface SuccessStory {
  id: string
  slug: string
  title: string
  summary?: string
  partner?: string
  industry?: string
  region?: string
  theme?: string
  metricsJson: Metric[]
  beforeJson: Metric[]
  afterJson: Metric[]
  body?: string
  coverImageId?: string | null
  status: StoryStatus
  featured: boolean
  visibility: Visibility
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  audienceType: AudienceType
  companyId?: string | null
  publishAt: string
  expireAt?: string | null
  active: boolean
  pinned: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  companyId?: string | null
  periodStart?: string
  periodEnd?: string
  amount: number
  currency: string
  status: InvoiceStatus
  issuedAt?: string
  lineItemsJson: LineItem[]
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  userId?: string | null
  companyId?: string | null
  kind: string
  title: string
  body?: string
  link?: string
  read: boolean
  createdAt: string
}

export interface AuditLog {
  id: string
  userId?: string | null
  actorName?: string
  entityType: string
  entityId?: string | null
  action: string
  oldValueJson?: unknown
  newValueJson?: unknown
  createdAt: string
}

/* ---------- hydrate bundle ---------- */
export interface HydrateBundle {
  me: User | null
  company: Company | null
  companies: Company[]
  sites: Site[]
  users: User[]
  departments: Department[]
  processes: Process[]
  machines: Machine[]
  scoringModels: ScoringModel[]
  calculatorIssues: CalcIssue[]
  occurrenceOptions: OccurrenceOption[]
  detectionOptions: DetectionOption[]
  technologyPrices: TechnologyPrice[]
  activeScoringModelId: string | null
  calculatorRuns: CalculatorRun[]
  serviceRequests: ServiceRequest[]
  requestTypes: RequestTypeDef[]
  requestDepartments: RequestDepartment[]
  requestProcesses: RequestProcess[]
  requestMachines: RequestMachine[]
  knowledgeArticles: KnowledgeArticle[]
  successStories: SuccessStory[]
  announcements: Announcement[]
  invoices: Invoice[]
  notifications: Notification[]
  auditLogs: AuditLog[]
}

export interface PublicBundle {
  successStories: SuccessStory[]
  knowledgeArticles: KnowledgeArticle[]
}
