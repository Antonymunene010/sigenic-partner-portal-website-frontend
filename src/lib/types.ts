export type Role = 'partner' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  company: string
  role: Role
  avatar?: string
  active: boolean
  createdAt: string
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

// Unified category across support (6.1) + service intake (6.2)
export type TicketCategory =
  | 'bug'
  | 'support'
  | 'feature'
  | 'demo'
  | 'onboarding'
  | 'data'
  | 'consulting'

export type ProductArea =
  | 'Lithography'
  | 'Etch'
  | 'CMP'
  | 'Deposition'
  | 'Inspection'
  | 'Metrology'
  | 'Portal'
  | 'Other'

export type CustomerImpact = 'critical' | 'high' | 'medium' | 'low'

export interface TicketMessage {
  id: string
  author: string
  authorRole: 'you' | 'agent' | 'system'
  body: string
  createdAt: string
}

export interface Ticket {
  id: string
  subject: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  productArea?: ProductArea
  customerImpact?: CustomerImpact
  requester: string
  assignee?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
  source?: 'portal' | 'calculator' | 'email'
}

export interface SuccessStory {
  id: string
  slug: string
  title: string
  summary: string
  partner: string
  industry: string
  region: string
  theme: 'yield' | 'excursion' | 'throughput' | 'downtime'
  metrics: { label: string; value: string }[]
  before?: { label: string; value: string }[]
  after?: { label: string; value: string }[]
  body: string
  publishedAt: string
  featured: boolean
}

export type DocCategory = 'FAQs' | 'Troubleshooting' | 'SOPs' | 'Known Issues' | 'Best Practices'

export interface Doc {
  id: string
  slug: string
  title: string
  category: DocCategory
  excerpt: string
  body: string
  updatedAt: string
  readMin: number
  keywords: string[]
}

export interface Invoice {
  id: string
  periodStart: string
  periodEnd: string
  amount: number
  status: 'paid' | 'open' | 'overdue'
  issuedAt: string
}

export type NotificationKind = 'ticket' | 'knowledge' | 'announcement'

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
  link?: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  createdAt: string
  author: string
  pinned: boolean
}

/* ----- Calculator data model ----- */

export interface Fab {
  id: string
  name: string
  location: string
}

export interface Department {
  id: string
  name: string
  machineIds: string[]
}

export interface MachineParam {
  key: string
  label: string
  unit: string
  default: number
  min: number
  max: number
  step: number
}

export interface Machine {
  id: string
  name: string
  family: 'Lithography' | 'Etch' | 'CMP' | 'Deposition' | 'Inspection' | 'Metrology'
  node: string
  baselineCostPerWafer: number
  defaultThroughput: number
  params: MachineParam[]
}

export interface Process {
  id: string
  name: string
  stepCount: number
  complexity: 1 | 2 | 3 | 4 | 5
  optimizationFactor: number
  yieldUpliftPct: number
  scrapReductionPct: number
  downtimeReductionPct: number
  compatibleMachines: string[]
}

export interface CalcConfig {
  fabs: Fab[]
  departments: Department[]
  machines: Machine[]
  processes: Process[]
  globals: {
    waferRevenue: number
    laborRatePerHour: number
    energyCostPerKWh: number
    serviceFeePct: number
  }
}

export interface OperationalInputs {
  yieldPct: number
  defectRate: number
  throughput: number
  scrapRate: number
  downtimePct: number
}

export interface BusinessInputs {
  costPerWafer: number
  volumePerMonth: number
  costOfExcursion: number
}

export interface CalcSelection {
  fabId: string
  departmentId: string
  machineId: string
  processIds: string[]
  params: Record<string, number>
  operational: OperationalInputs
  business: BusinessInputs
}

export interface CalcResult {
  input: CalcSelection
  yieldImprovementPct: number
  scrapReductionPct: number
  downtimeReductionPct: number
  monthlySavings: number
  annualSavings: number
  fasterDetectionHrs: number
  manualEffortReductionHrs: number
  paybackMonths: number
  score: number
  breakdown: { label: string; value: number }[]
}

/* ----- Admin operations layer ----- */

export type PartnerStatus = 'active' | 'onboarding' | 'inactive'
export type PartnerTier = 'trial' | 'standard' | 'plus' | 'strategic'

export type PermissionKey =
  | 'calculator'
  | 'case_studies'
  | 'service_requests'
  | 'billing'
  | 'zendesk'

export interface PartnerSite {
  id: string
  name: string
  region: string
  fabs: string[]
}

export interface OnboardingMilestone {
  key: string
  label: string
  done: boolean
  completedAt?: string
}

export interface PartnerCompany {
  id: string
  name: string
  status: PartnerStatus
  tier: PartnerTier
  primaryContact: string
  billingContact: string
  sites: PartnerSite[]
  permissions: Record<PermissionKey, boolean>
  contractStart: string
  renewalDate: string
  serviceTier: string
  subscriptionType: string
  trial: boolean
  onboarding: OnboardingMilestone[]
}

export interface KnowledgeGovernance {
  docId: string
  owner: string
  status: 'draft' | 'approved' | 'review_needed'
  featured: boolean
  reviewDue: string
  visibleTo: string[]
  tags: string[]
}

export interface RequestWorkflow {
  id: TicketCategory
  label: string
  enabled: boolean
  route: 'zendesk' | 'sales' | 'ops'
  ownerRole: string
  requiredFields: string[]
  zendeskTags: string[]
}

export interface AuditEvent {
  id: string
  actor: string
  action: string
  target: string
  details: string
  createdAt: string
}

export interface OpsConfig {
  partners: PartnerCompany[]
  knowledge: KnowledgeGovernance[]
  workflows: RequestWorkflow[]
  audit: AuditEvent[]
}
