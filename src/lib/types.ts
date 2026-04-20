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

export type TicketStatus = 'open' | 'pending' | 'solved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketCategory = 'technical' | 'billing' | 'demo' | 'general' | 'feature'

export interface TicketMessage {
  id: string
  author: string
  authorRole: 'you' | 'agent' | 'system'
  body: string
  createdAt: string
}

export interface Ticket {
  id: string // e.g. TKT-00123
  subject: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  requester: string
  assignee?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
}

export interface SuccessStory {
  id: string
  slug: string
  title: string
  summary: string
  partner: string
  industry: string
  region: string
  metrics: { label: string; value: string }[]
  body: string
  publishedAt: string
  featured: boolean
}

export interface Doc {
  id: string
  slug: string
  title: string
  category: 'Getting Started' | 'Integrations' | 'API' | 'Operations' | 'Best Practices'
  excerpt: string
  body: string
  updatedAt: string
  readMin: number
}

export interface Invoice {
  id: string // INV-000123
  periodStart: string
  periodEnd: string
  amount: number
  status: 'paid' | 'open' | 'overdue'
  issuedAt: string
}

/* ----- Calculator data model ----- */
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
  family: 'Lithography' | 'Etch' | 'Deposition' | 'Inspection' | 'Metrology'
  node: string // e.g. "7nm-capable"
  baselineCostPerWafer: number // USD
  defaultThroughput: number // wafers per hour
  params: MachineParam[]
}

export interface Process {
  id: string
  name: string
  stepCount: number // number of process steps this covers
  complexity: 1 | 2 | 3 | 4 | 5
  optimizationFactor: number // 0..1 representing savings potential
  yieldUpliftPct: number // additional yield % from optimization
  compatibleMachines: string[] // machine ids
}

export interface CalcConfig {
  machines: Machine[]
  processes: Process[]
  // Global constants
  globals: {
    waferRevenue: number // $ per wafer
    laborRatePerHour: number // $ per hour
    energyCostPerKWh: number
    serviceFeePct: number // Axiom's service fee, subtracted from savings
  }
}

export interface CalcSelection {
  machineId: string
  processIds: string[]
  params: Record<string, number>
  wafersPerMonth: number
  hoursPerDay: number
  daysPerMonth: number
}

export interface CalcResult {
  input: CalcSelection
  baselineCostMonthly: number
  optimizedCostMonthly: number
  savingsMonthly: number
  savingsAnnual: number
  yieldUpliftPct: number
  throughputUpliftPct: number
  paybackMonths: number
  score: number // 0..100
  breakdown: { label: string; value: number }[]
}
