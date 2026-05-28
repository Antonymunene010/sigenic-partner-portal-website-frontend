import type {
  Announcement,
  CalcConfig,
  Doc,
  Invoice,
  Notification,
  SuccessStory,
  Ticket,
  User,
} from './types'
import { load, saveLocalOnly } from './storage'

const SEED_VERSION = 7

export function seedIfNeeded() {
  const cur = load<number>('seed.v', 0)
  if (cur === SEED_VERSION) return
  saveLocalOnly('seed.v', SEED_VERSION)
  saveLocalOnly('users', seedUsers)
  saveLocalOnly('tickets', seedTickets)
  saveLocalOnly('stories', seedStories)
  saveLocalOnly('docs', seedDocs)
  saveLocalOnly('invoices', seedInvoices)
  saveLocalOnly('calc', seedCalc)
  saveLocalOnly('announcements', seedAnnouncements)
  saveLocalOnly('notifications', seedNotifications)
}

const iso = (daysAgo: number, hoursAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString()

export const seedUsers: User[] = [
  {
    id: 'u-001',
    email: 'partner@demo.com',
    name: 'Wei Tan',
    company: 'SiliconPeak Labs',
    role: 'partner',
    active: true,
    createdAt: iso(120),
  },
  {
    id: 'u-002',
    email: 'admin@demo.com',
    name: 'Priya Nair',
    company: 'Sigenic',
    role: 'admin',
    active: true,
    createdAt: iso(220),
  },
  {
    id: 'u-003',
    email: 'karen@novacell.sg',
    name: 'Karen Lim',
    company: 'NovaCell Systems',
    role: 'partner',
    active: true,
    createdAt: iso(64),
  },
  {
    id: 'u-004',
    email: 'daniel@quantex.com',
    name: 'Daniel Ong',
    company: 'Quantex Semiconductors',
    role: 'partner',
    active: true,
    createdAt: iso(30),
  },
  {
    id: 'u-005',
    email: 'marta@aperture.io',
    name: 'Marta Gomez',
    company: 'Aperture Wafer Co.',
    role: 'partner',
    active: false,
    createdAt: iso(410),
  },
]

export const seedTickets: Ticket[] = [
  {
    id: 'TKT-00241',
    subject: 'Calibration drift on EUV scanner after firmware update',
    status: 'open',
    priority: 'high',
    category: 'bug',
    productArea: 'Lithography',
    customerImpact: 'high',
    requester: 'Wei Tan',
    assignee: 'Sigenic Field Eng.',
    tags: ['EUV', 'firmware', 'calibration'],
    createdAt: iso(1, 4),
    updatedAt: iso(0, 2),
    source: 'portal',
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'After the 2.4.1 firmware rollout our EUV scanner shows a 0.7nm overlay drift at wafer edge. Happens on lot SPL-9A onwards. Attaching run logs next reply.',
        createdAt: iso(1, 4),
      },
      {
        id: 'm2',
        author: 'Sigenic Support',
        authorRole: 'agent',
        body: 'Thanks Wei — we’ve seen two similar reports post-2.4.1. A hotfix is queued for Thursday. In the meantime, reverting to 2.4.0 is safe. Can you share the last calibration report?',
        createdAt: iso(1, 1),
      },
      {
        id: 'm3',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'Calibration report uploaded. Let me know if you need the raw interferometry data.',
        createdAt: iso(0, 3),
      },
    ],
  },
  {
    id: 'TKT-00240',
    subject: 'Request on-site demo for AX-Etch 600 series',
    status: 'in_progress',
    priority: 'normal',
    category: 'demo',
    productArea: 'Etch',
    customerImpact: 'medium',
    requester: 'Wei Tan',
    tags: ['demo', 'etch'],
    createdAt: iso(3, 2),
    updatedAt: iso(1, 5),
    source: 'portal',
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'We’d like to evaluate the AX-Etch 600 for a 5nm pilot line. Can we schedule an on-site demo at our Tuas facility in the next two weeks?',
        createdAt: iso(3, 2),
      },
      {
        id: 'm2',
        author: 'System',
        authorRole: 'system',
        body: 'Demo request routed to Sigenic APAC sales. A rep will reach out within 1 business day.',
        createdAt: iso(3, 1),
      },
      {
        id: 'm3',
        author: 'Sigenic Sales',
        authorRole: 'agent',
        body: 'Hi Wei — Priya here, I handle APAC demos. We have slots Apr 28 and Apr 30. Which suits your team? I’ll send a logistics checklist once confirmed.',
        createdAt: iso(1, 5),
      },
    ],
  },
  {
    id: 'TKT-00238',
    subject: 'Data analysis request: overlay drift correlation study',
    status: 'resolved',
    priority: 'normal',
    category: 'data',
    productArea: 'Metrology',
    customerImpact: 'medium',
    requester: 'Wei Tan',
    tags: ['analysis', 'metrology'],
    createdAt: iso(8),
    updatedAt: iso(6),
    source: 'portal',
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'Can your team correlate overlay drift against chamber soak time for lots SPL-8A through SPL-9D?',
        createdAt: iso(8),
      },
      {
        id: 'm2',
        author: 'Sigenic Analytics',
        authorRole: 'agent',
        body: 'Report attached. Strong correlation (r=0.71) above 9 min soak. Recommend keeping below 7.5 min.',
        createdAt: iso(6),
      },
    ],
  },
  {
    id: 'TKT-00235',
    subject: 'Feature request: batch upload to wafer map viewer',
    status: 'open',
    priority: 'low',
    category: 'feature',
    productArea: 'Portal',
    customerImpact: 'low',
    requester: 'Wei Tan',
    tags: ['feature', 'viewer'],
    createdAt: iso(12),
    updatedAt: iso(10),
    source: 'portal',
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'Would be great if we could upload a folder of wafer maps rather than one by one.',
        createdAt: iso(12),
      },
      {
        id: 'm2',
        author: 'Sigenic Product',
        authorRole: 'agent',
        body: 'Tracked in roadmap item VIEW-88. Targeting Q3.',
        createdAt: iso(10),
      },
    ],
  },
  {
    id: 'TKT-00231',
    subject: 'API rate limit clarification',
    status: 'closed',
    priority: 'low',
    category: 'support',
    productArea: 'Portal',
    customerImpact: 'low',
    requester: 'Wei Tan',
    tags: ['api'],
    createdAt: iso(20),
    updatedAt: iso(19),
    source: 'portal',
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'What is the actual rate limit on the yield data endpoint?',
        createdAt: iso(20),
      },
      {
        id: 'm2',
        author: 'Sigenic Support',
        authorRole: 'agent',
        body: '120 requests / minute / token, bursts up to 240 for 10 seconds.',
        createdAt: iso(19),
      },
    ],
  },
]

export const seedStories: SuccessStory[] = [
  {
    id: 's-001',
    slug: 'novacell-38pct-yield-lift',
    title: 'NovaCell lifts 7nm yield by 38% with Sigenic-tuned etch recipes',
    summary:
      'A two-quarter rollout with recipe co-tuning moved NovaCell’s 7nm logic line from 61% to 84% parametric yield.',
    partner: 'NovaCell Systems',
    industry: 'Logic · 7nm',
    region: 'Singapore',
    theme: 'yield',
    metrics: [
      { label: 'Yield lift', value: '+38%' },
      { label: 'Cost / wafer', value: '-$412' },
      { label: 'Payback', value: '4.1 mo' },
    ],
    body:
      'NovaCell partnered with Sigenic across two quarters to overhaul etch uniformity on their 7nm logic line. Starting baseline parametric yield was 61%, with a long tail of edge-die defects traced to chamber-edge plasma non-uniformity. Sigenic deployed partner-specific recipe variants and introduced closed-loop sensor data into the calibration workflow. Within 14 weeks, yield reached 84%, and per-wafer cost dropped $412. The partnership continues to iterate on recipe optimization for upcoming 5nm ramp.',
    publishedAt: iso(18),
    featured: true,
  },
  {
    id: 's-002',
    slug: 'quantex-excursion-prevention',
    title: 'Quantex prevents $2.4M excursion with early-warning telemetry',
    summary:
      'Sigenic’s chamber-pressure anomaly model caught a DRAM excursion four hours before it would have scrapped 1,200 wafers.',
    partner: 'Quantex Semiconductors',
    industry: 'Memory · DRAM',
    region: 'Malaysia',
    theme: 'excursion',
    metrics: [
      { label: 'Excursion avoided', value: '$2.4M' },
      { label: 'Lead time', value: '4 hrs' },
      { label: 'Wafers saved', value: '1,200' },
    ],
    before: [
      { label: 'Detection time', value: '6–12 hrs' },
      { label: 'False alert rate', value: '14%' },
      { label: 'Scrap per excursion', value: '~900 wafers' },
    ],
    after: [
      { label: 'Detection time', value: '< 30 min' },
      { label: 'False alert rate', value: '3%' },
      { label: 'Scrap per excursion', value: '0–50 wafers' },
    ],
    body:
      'Quantex deployed Sigenic telemetry across 14 deposition tools, streaming vibration, chamber pressure, and power signatures into a shared anomaly-detection pipeline. A pressure anomaly flagged on Lot QX-DR2205 led the fab to pause processing and discover a worn seal — preventing 1,200 wafers from scrap and an estimated $2.4M loss. Mean detection time dropped from 6–12 hours to under 30 minutes.',
    publishedAt: iso(40),
    featured: true,
  },
  {
    id: 's-003',
    slug: 'aperture-wafer-automation',
    title: 'Aperture automates wafer map QA across three sites',
    summary:
      'A unified review workflow cut Aperture’s QA operator hours by 54% while flagging twice as many marginal dies.',
    partner: 'Aperture Wafer Co.',
    industry: 'Foundry services',
    region: 'Taiwan',
    theme: 'throughput',
    metrics: [
      { label: 'QA hours', value: '-54%' },
      { label: 'Marginal catch', value: '+2×' },
      { label: 'Sites unified', value: '3' },
    ],
    body:
      'Aperture rolled out Sigenic’s review viewer across three sites with shared rules and reviewer queues, reducing redundant QA and establishing a single source of truth for marginal die escalation.',
    publishedAt: iso(75),
    featured: false,
  },
  {
    id: 's-004',
    slug: 'siliconpeak-capacity',
    title: 'SiliconPeak unlocks 18% extra capacity with throughput co-tuning',
    summary:
      'A one-week co-tuning sprint added 18% effective throughput to SiliconPeak’s photolithography cell without any capex.',
    partner: 'SiliconPeak Labs',
    industry: 'Logic · 10nm',
    region: 'Singapore',
    theme: 'throughput',
    metrics: [
      { label: 'Throughput', value: '+18%' },
      { label: 'Capex', value: '$0' },
      { label: 'Sprint', value: '5 days' },
    ],
    body:
      'A focused co-tuning engagement on photolithography dose-focus parameters delivered measurable throughput gains with zero hardware changes, proving out the baseline for a broader line-wide optimization.',
    publishedAt: iso(110),
    featured: false,
  },
]

export const seedDocs: Doc[] = [
  {
    id: 'd-001',
    slug: 'overlay-drift-firmware-241',
    title: 'Overlay drift after scanner firmware 2.4.1',
    category: 'Known Issues',
    excerpt: 'Known regression on EUV scanners after the 2.4.1 firmware rollout. Workaround and hotfix status.',
    body:
      '# Known Issue · Overlay drift after firmware 2.4.1\n\nSome EUV scanners show ~0.7nm overlay drift at wafer edge following the 2.4.1 firmware rollout. Affected serials in advisory SA-026.\n\n## Workaround\n\nRevert to firmware 2.4.0 on affected scanners. Revert is non-destructive and retains calibration state.\n\n## Fix timeline\n\nHotfix 2.4.2 targeted for this Thursday. Track status on the Sigenic status page.',
    updatedAt: iso(1),
    readMin: 3,
    keywords: ['overlay', 'drift', 'euv', 'scanner', 'firmware', '2.4.1', 'calibration', 'lithography'],
  },
  {
    id: 'd-002',
    slug: 'etch-plasma-nonuniformity-troubleshoot',
    title: 'Troubleshooting plasma non-uniformity on etch tools',
    category: 'Troubleshooting',
    excerpt: 'Diagnose edge-die defects, chamber-edge plasma drift, and recipe sensitivities.',
    body:
      '# Troubleshooting · Plasma non-uniformity\n\nWhen edge-die yield drops and the center of the wafer looks nominal, plasma non-uniformity is the most common root cause.\n\n## Checklist\n\n1. Verify chamber match against last known good (LKG) record\n2. Check RF match calibration\n3. Review chamber soak time — extended soak can mask non-uniformity transients\n4. Pull last 10 wafers of APC (advanced process control) data\n\nEscalate via ticket with attached LKG delta if items 1–2 do not restore uniformity.',
    updatedAt: iso(6),
    readMin: 6,
    keywords: ['etch', 'plasma', 'uniformity', 'edge', 'defect', 'yield', 'troubleshooting'],
  },
  {
    id: 'd-003',
    slug: 'calculator-logic-sop',
    title: 'Score Calculator: how outputs are derived',
    category: 'SOPs',
    excerpt: 'Inputs, model assumptions, guardrails, and why estimates should be validated with a pilot run.',
    body:
      '# SOP · Score Calculator\n\nThe calculator combines baseline cost per wafer, yield, scrap, and downtime rates against a rule-based optimization model. Outputs are bounded estimates — always validate with a pilot run before capacity planning.\n\nAssumptions are editable under Admin → Scoring rules.',
    updatedAt: iso(3),
    readMin: 5,
    keywords: ['calculator', 'scoring', 'roi', 'savings', 'yield', 'model', 'assumptions'],
  },
  {
    id: 'd-004',
    slug: 'faq-billing',
    title: 'Billing FAQs',
    category: 'FAQs',
    excerpt: 'Common questions about invoices, credits, and billing cycles.',
    body:
      '# Billing FAQs\n\n**Q: When is my invoice issued?**  On the 1st of each month for the prior period.\n\n**Q: Net terms?**  Net 30 against MSA.\n\n**Q: Disputing a charge?**  Open a support ticket with the invoice ID; a billing agent will respond within 1 business day.',
    updatedAt: iso(30),
    readMin: 2,
    keywords: ['billing', 'invoice', 'payment', 'credit', 'refund', 'faq'],
  },
  {
    id: 'd-005',
    slug: 'faq-portal-access',
    title: 'Portal access FAQs',
    category: 'FAQs',
    excerpt: 'Logins, seats, SSO roadmap, and invite flow.',
    body: '# Portal access\n\n**Q: How do I invite a colleague?**  Admins can invite from Settings → Team.\n\n**Q: SSO support?**  SAML/OIDC is on the roadmap for Q3.\n\n**Q: Deactivated users?**  Their tickets remain; history is preserved.',
    updatedAt: iso(22),
    readMin: 2,
    keywords: ['login', 'access', 'sso', 'invite', 'seats', 'faq'],
  },
  {
    id: 'd-006',
    slug: 'sop-pilot-design',
    title: 'Designing an effective pilot run',
    category: 'Best Practices',
    excerpt: 'Scoping, success metrics, and the two most common pilot failure modes.',
    body:
      '# Pilot design\n\nSuccessful pilots are narrow, measurable, and time-boxed. Two common failure modes: overly broad scope, and missing pre/post measurement.',
    updatedAt: iso(22),
    readMin: 7,
    keywords: ['pilot', 'measurement', 'scope', 'best practice', 'planning'],
  },
  {
    id: 'd-007',
    slug: 'sop-data-residency',
    title: 'Data residency & privacy SOP',
    category: 'SOPs',
    excerpt: 'Regional ingest, retention, and customer-managed key options.',
    body: '# Data residency\n\nSigenic operates ingest regions in Singapore, EU, and US. Data does not leave its ingest region by default.',
    updatedAt: iso(60),
    readMin: 5,
    keywords: ['data', 'residency', 'privacy', 'region', 'retention', 'security'],
  },
  {
    id: 'd-008',
    slug: 'known-issue-ingest-sg2-maintenance',
    title: 'Scheduled maintenance: ingest SG-2 window',
    category: 'Known Issues',
    excerpt: 'Planned maintenance windows for ingest SG-2. Events are buffered and replayed.',
    body:
      '# Known Issue · Ingest SG-2 maintenance\n\nMaintenance windows are scheduled on the 1st Saturday of each month, 02:00–03:00 SGT. Events from that region are buffered upstream and replayed once the service resumes.',
    updatedAt: iso(9),
    readMin: 2,
    keywords: ['maintenance', 'ingest', 'sg-2', 'downtime', 'known issue', 'status'],
  },
]

export const seedInvoices: Invoice[] = [
  { id: 'INV-000142', periodStart: iso(30), periodEnd: iso(0), amount: 18450, status: 'open', issuedAt: iso(2) },
  { id: 'INV-000138', periodStart: iso(60), periodEnd: iso(31), amount: 17220, status: 'paid', issuedAt: iso(32) },
  { id: 'INV-000134', periodStart: iso(90), periodEnd: iso(61), amount: 17985, status: 'paid', issuedAt: iso(62) },
  { id: 'INV-000130', periodStart: iso(120), periodEnd: iso(91), amount: 16340, status: 'paid', issuedAt: iso(92) },
  { id: 'INV-000126', periodStart: iso(150), periodEnd: iso(121), amount: 15980, status: 'paid', issuedAt: iso(122) },
]

export const seedAnnouncements: Announcement[] = [
  {
    id: 'ann-001',
    title: 'Portal v0.9 — new Score Calculator with excursion modeling',
    body: 'We just shipped a rewritten Score Calculator that includes fab/department context and excursion-cost modeling. Estimates are now aligned with our pilot-engagement methodology. See the updated SOP for details.',
    createdAt: iso(2),
    author: 'Priya Nair · Product',
    pinned: true,
  },
  {
    id: 'ann-002',
    title: 'Scheduled maintenance: ingest SG-2, Apr 26 02:00 SGT',
    body: 'Ingest region SG-2 will have a 1-hour maintenance window on April 26 at 02:00 SGT. Telemetry from that region will be buffered and replayed once service resumes.',
    createdAt: iso(5),
    author: 'Sigenic Ops',
    pinned: false,
  },
]

export const seedNotifications: Notification[] = [
  {
    id: 'n-001',
    kind: 'announcement',
    title: 'Portal v0.9 — new Score Calculator with excursion modeling',
    body: 'The Score Calculator now supports fab/department context and excursion-cost modeling.',
    createdAt: iso(2),
    read: false,
    link: '/app/calculator',
  },
  {
    id: 'n-002',
    kind: 'ticket',
    title: 'Ticket TKT-00241 updated',
    body: 'Sigenic Support replied to "Calibration drift on EUV scanner after firmware update".',
    createdAt: iso(0, 2),
    read: false,
    link: '/app/support/TKT-00241',
  },
  {
    id: 'n-003',
    kind: 'knowledge',
    title: 'New known issue published',
    body: 'Overlay drift after scanner firmware 2.4.1 — read the workaround.',
    createdAt: iso(1),
    read: true,
    link: '/app/docs/overlay-drift-firmware-241',
  },
  {
    id: 'n-004',
    kind: 'announcement',
    title: 'Scheduled maintenance: ingest SG-2, Apr 26 02:00 SGT',
    body: 'SG-2 will have a 1-hour maintenance window.',
    createdAt: iso(5),
    read: true,
  },
]

/* Calculator seed — matches PRD 6.8 context (Fab + Department + Process + Machine) */
export const seedCalc: CalcConfig = {
  globals: {
    waferRevenue: 1100,
    laborRatePerHour: 58,
    energyCostPerKWh: 0.18,
    serviceFeePct: 0.18,
  },
  fabs: [
    { id: 'fab-sg-tuas', name: 'SG · Tuas 1', location: 'Singapore' },
    { id: 'fab-sg-woodlands', name: 'SG · Woodlands', location: 'Singapore' },
    { id: 'fab-my-johor', name: 'MY · Johor', location: 'Malaysia' },
    { id: 'fab-tw-hsinchu', name: 'TW · Hsinchu', location: 'Taiwan' },
  ],
  departments: [
    { id: 'dept-litho', name: 'Lithography', machineIds: ['mch-sg-litho-900', 'mch-sg-metro-pro'] },
    { id: 'dept-etch', name: 'Etch', machineIds: ['mch-sg-etch-600'] },
    { id: 'dept-cmp', name: 'CMP', machineIds: ['mch-sg-cmp-220'] },
    { id: 'dept-dep', name: 'Deposition', machineIds: ['mch-sg-dep-300'] },
    { id: 'dept-insp', name: 'Inspection & Metrology', machineIds: ['mch-sg-insp-v5', 'mch-sg-metro-pro'] },
  ],
  machines: [
    {
      id: 'mch-sg-litho-900',
      name: 'SG-Litho 900',
      family: 'Lithography',
      node: '5nm-capable',
      baselineCostPerWafer: 780,
      defaultThroughput: 85,
      params: [
        { key: 'doseVariance', label: 'Dose variance', unit: '%', default: 2.4, min: 0.5, max: 6, step: 0.1 },
        { key: 'focusOffset', label: 'Focus offset', unit: 'nm', default: 14, min: 0, max: 40, step: 1 },
      ],
    },
    {
      id: 'mch-sg-etch-600',
      name: 'SG-Etch 600',
      family: 'Etch',
      node: '7nm-capable',
      baselineCostPerWafer: 540,
      defaultThroughput: 110,
      params: [
        { key: 'plasmaUniformity', label: 'Plasma uniformity', unit: '%', default: 3.2, min: 0.8, max: 8, step: 0.1 },
        { key: 'chamberSoakMin', label: 'Chamber soak', unit: 'min', default: 6, min: 2, max: 20, step: 1 },
      ],
    },
    {
      id: 'mch-sg-cmp-220',
      name: 'SG-CMP 220',
      family: 'CMP',
      node: '10nm-capable',
      baselineCostPerWafer: 310,
      defaultThroughput: 120,
      params: [
        { key: 'padConditioning', label: 'Pad conditioning', unit: 'count', default: 4, min: 1, max: 12, step: 1 },
        { key: 'slurryFlow', label: 'Slurry flow', unit: 'ml/min', default: 180, min: 50, max: 400, step: 10 },
      ],
    },
    {
      id: 'mch-sg-dep-300',
      name: 'SG-Depose 300',
      family: 'Deposition',
      node: '10nm-capable',
      baselineCostPerWafer: 420,
      defaultThroughput: 140,
      params: [
        { key: 'filmThicknessVar', label: 'Film thickness variance', unit: '%', default: 2.1, min: 0.5, max: 6, step: 0.1 },
        { key: 'precursorFlow', label: 'Precursor flow', unit: 'sccm', default: 85, min: 20, max: 200, step: 5 },
      ],
    },
    {
      id: 'mch-sg-insp-v5',
      name: 'SG-Inspect V5',
      family: 'Inspection',
      node: 'All nodes',
      baselineCostPerWafer: 180,
      defaultThroughput: 220,
      params: [
        { key: 'defectThresholdNm', label: 'Defect threshold', unit: 'nm', default: 22, min: 8, max: 80, step: 1 },
      ],
    },
    {
      id: 'mch-sg-metro-pro',
      name: 'SG-Metro Pro',
      family: 'Metrology',
      node: 'All nodes',
      baselineCostPerWafer: 220,
      defaultThroughput: 180,
      params: [
        { key: 'sampleRate', label: 'Sample rate', unit: '/lot', default: 9, min: 1, max: 25, step: 1 },
      ],
    },
  ],
  processes: [
    {
      id: 'p-overlay',
      name: 'Overlay co-tuning',
      stepCount: 6,
      complexity: 4,
      optimizationFactor: 0.18,
      yieldUpliftPct: 2.4,
      scrapReductionPct: 1.2,
      downtimeReductionPct: 0.8,
      compatibleMachines: ['mch-sg-litho-900', 'mch-sg-metro-pro'],
    },
    {
      id: 'p-etch-unif',
      name: 'Etch uniformity recipe',
      stepCount: 5,
      complexity: 3,
      optimizationFactor: 0.22,
      yieldUpliftPct: 3.1,
      scrapReductionPct: 2.0,
      downtimeReductionPct: 0.5,
      compatibleMachines: ['mch-sg-etch-600'],
    },
    {
      id: 'p-cmp-removal',
      name: 'CMP removal-rate tuning',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.12,
      yieldUpliftPct: 1.4,
      scrapReductionPct: 1.0,
      downtimeReductionPct: 0.4,
      compatibleMachines: ['mch-sg-cmp-220'],
    },
    {
      id: 'p-film-control',
      name: 'Film thickness control',
      stepCount: 4,
      complexity: 2,
      optimizationFactor: 0.14,
      yieldUpliftPct: 1.6,
      scrapReductionPct: 0.8,
      downtimeReductionPct: 0.3,
      compatibleMachines: ['mch-sg-dep-300', 'mch-sg-metro-pro'],
    },
    {
      id: 'p-defect-triage',
      name: 'Defect triage automation',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.11,
      yieldUpliftPct: 1.1,
      scrapReductionPct: 1.5,
      downtimeReductionPct: 0.2,
      compatibleMachines: ['mch-sg-insp-v5', 'mch-sg-metro-pro'],
    },
    {
      id: 'p-excursion-early',
      name: 'Excursion early-warning',
      stepCount: 4,
      complexity: 3,
      optimizationFactor: 0.13,
      yieldUpliftPct: 0.9,
      scrapReductionPct: 4.0,
      downtimeReductionPct: 1.2,
      compatibleMachines: ['mch-sg-etch-600', 'mch-sg-dep-300', 'mch-sg-cmp-220', 'mch-sg-insp-v5'],
    },
    {
      id: 'p-predictive-maint',
      name: 'Predictive maintenance',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.09,
      yieldUpliftPct: 0.5,
      scrapReductionPct: 0.3,
      downtimeReductionPct: 3.2,
      compatibleMachines: ['mch-sg-etch-600', 'mch-sg-dep-300', 'mch-sg-litho-900', 'mch-sg-cmp-220'],
    },
  ],
}
