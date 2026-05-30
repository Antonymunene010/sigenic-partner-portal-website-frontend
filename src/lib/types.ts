/**
 * Frontend data contract — mirrors the PRD relational schema and the camelCase
 * shapes returned by the Node API (server/store.js rowToObj). Keep in sync with
 * server/schema.js.
 */

/* ---------- enums ---------- */
export type CompanyType = 'sigenic' | 'distributor' | 'customer'
export type OrgStatus = 'active' | 'inactive' | 'prospect'
export type OnboardingStatus = 'not_started' | 'invited' | 'in_progress' | 'fully_onboarded'

export type Role =
  | 'super_admin'
  | 'admin'
  | 'support_engineer'
  | 'distributor_admin'
  | 'distributor_user'
  | 'customer_admin'
  | 'customer_user'
export type UserType = 'internal' | 'distributor' | 'customer'
export type UserStatus = 'active' | 'inactive' | 'invited'

export type MetricType =
  | 'yield_improvement'
  | 'scrap_reduction'
  | 'downtime_reduction'
  | 'detection_speed_improvement'
export type ModelStatus = 'draft' | 'active' | 'archived'

export type RequestType = 'support' | 'demo' | 'onboarding' | 'consultation' | 'feature_request'
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
  industry?: string
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

export interface ScoringRule {
  id: string
  scoringModelId: string
  departmentId?: string | null
  processId?: string | null
  machineId?: string | null
  metricType: MetricType
  minValue: number
  maxValue: number
  weight: number
  defaultValue?: number | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface FinancialAssumption {
  id: string
  scoringModelId: string
  companyId?: string | null
  siteId?: string | null
  costPerWaferDefault: number
  excursionCostDefault: number
  monthlyVolumeDefault: number
  laborCostDefault?: number | null
  currency: string
  createdAt: string
  updatedAt: string
}

export interface Range {
  min: number
  max: number
}

export interface RoiResult {
  modelId: string | null
  modelVersion: string | null
  yieldImprovement: Range
  scrapReduction: Range
  downtimeReduction: Range
  detectionSpeedImprovement: Range
  monthlySavings: Range
  annualSavings: Range
  score: number
  assumptionsUsed: { costPerWafer: number; monthlyVolume: number; excursionCost: number }
  breakdown: { label: string; value: number }[]
  limited?: boolean
}

export interface CalcSelection {
  companyId?: string
  siteId?: string
  departmentId?: string
  processId?: string
  machineId?: string
  currentYieldPct?: number
  defectRate?: number
  throughput?: number
  scrapRate?: number
  downtime?: number
  costPerWafer?: number
  monthlyVolume?: number
  excursionCost?: number
}

export interface CalculatorRun {
  id: string
  companyId?: string | null
  siteId?: string | null
  userId?: string | null
  runType: 'public' | 'partner' | 'distributor' | 'internal'
  scoringModelId?: string | null
  departmentId?: string | null
  processId?: string | null
  machineId?: string | null
  currentYieldPct?: number | null
  defectRate?: number | null
  throughput?: number | null
  scrapRate?: number | null
  downtime?: number | null
  costPerWafer?: number | null
  monthlyVolume?: number | null
  excursionCost?: number | null
  estimatedYieldImprovementMin?: number | null
  estimatedYieldImprovementMax?: number | null
  estimatedMonthlySavingsMin?: number | null
  estimatedMonthlySavingsMax?: number | null
  estimatedAnnualSavingsMin?: number | null
  estimatedAnnualSavingsMax?: number | null
  outputSummaryJson?: RoiResult | null
  createdAt: string
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
  requestType: RequestType
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
  scoringRules: ScoringRule[]
  financialAssumptions: FinancialAssumption[]
  activeScoringModelId: string | null
  calculatorRuns: CalculatorRun[]
  serviceRequests: ServiceRequest[]
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
