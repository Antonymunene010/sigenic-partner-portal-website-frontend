import type {
  CustomerImpact,
  DocCategory,
  ProductArea,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './types'

export const PRODUCT_AREAS: ProductArea[] = [
  'Lithography',
  'Etch',
  'CMP',
  'Deposition',
  'Inspection',
  'Metrology',
  'Portal',
  'Other',
]

export const TICKET_PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low']
export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']
export const CUSTOMER_IMPACTS: CustomerImpact[] = ['low', 'medium', 'high', 'critical']

export const TICKET_CATEGORIES: TicketCategory[] = [
  'bug',
  'support',
  'feature',
  'demo',
  'onboarding',
  'data',
  'consulting',
]

export const DOC_CATEGORY_ORDER: DocCategory[] = [
  'FAQs',
  'Troubleshooting',
  'SOPs',
  'Known Issues',
  'Best Practices',
]

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'open',
  in_progress: 'in progress',
  resolved: 'resolved',
  closed: 'closed',
}
