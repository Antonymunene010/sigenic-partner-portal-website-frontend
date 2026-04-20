import type { CalcConfig, Doc, Invoice, SuccessStory, Ticket, User } from './types'
import { load, save } from './storage'

const SEED_VERSION = 3

export function seedIfNeeded() {
  const cur = load<number>('seed.v', 0)
  if (cur === SEED_VERSION) return
  save('seed.v', SEED_VERSION)
  save('users', seedUsers)
  save('tickets', seedTickets)
  save('stories', seedStories)
  save('docs', seedDocs)
  save('invoices', seedInvoices)
  save('calc', seedCalc)
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
    company: 'Axiom Foundry',
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
    category: 'technical',
    requester: 'Wei Tan',
    assignee: 'Axiom Field Eng.',
    tags: ['EUV', 'firmware', 'calibration'],
    createdAt: iso(1, 4),
    updatedAt: iso(0, 2),
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
        author: 'Axiom Support',
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
    status: 'pending',
    priority: 'normal',
    category: 'demo',
    requester: 'Wei Tan',
    tags: ['demo', 'etch'],
    createdAt: iso(3, 2),
    updatedAt: iso(1, 5),
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
        body: 'Demo request routed to Axiom APAC sales. A rep will reach out within 1 business day.',
        createdAt: iso(3, 1),
      },
      {
        id: 'm3',
        author: 'Axiom Sales',
        authorRole: 'agent',
        body: 'Hi Wei — Priya here, I handle APAC demos. We have slots Apr 28 and Apr 30. Which suits your team? I’ll send a logistics checklist once confirmed.',
        createdAt: iso(1, 5),
      },
    ],
  },
  {
    id: 'TKT-00238',
    subject: 'Billing discrepancy on March invoice',
    status: 'solved',
    priority: 'normal',
    category: 'billing',
    requester: 'Wei Tan',
    tags: ['billing', 'invoice'],
    createdAt: iso(8),
    updatedAt: iso(6),
    messages: [
      {
        id: 'm1',
        author: 'Wei Tan',
        authorRole: 'you',
        body: 'March invoice shows 2× the expected service fee. Can you review?',
        createdAt: iso(8),
      },
      {
        id: 'm2',
        author: 'Axiom Billing',
        authorRole: 'agent',
        body: 'Confirmed — duplicate line from the re-billing run. Credit note CN-00412 issued. Apologies for the noise.',
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
    requester: 'Wei Tan',
    tags: ['feature', 'viewer'],
    createdAt: iso(12),
    updatedAt: iso(10),
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
        author: 'Axiom Product',
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
    category: 'general',
    requester: 'Wei Tan',
    tags: ['api'],
    createdAt: iso(20),
    updatedAt: iso(19),
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
        author: 'Axiom Support',
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
    title: 'NovaCell lifts 7nm yield by 38% with AX-Etch 600',
    summary:
      'A two-quarter rollout of the AX-Etch 600 plus recipe co-tuning moved NovaCell’s 7nm logic line from 61% to 84% parametric yield.',
    partner: 'NovaCell Systems',
    industry: 'Logic · 7nm',
    region: 'Singapore',
    metrics: [
      { label: 'Yield lift', value: '+38%' },
      { label: 'Cost / wafer', value: '-$412' },
      { label: 'Payback', value: '4.1 mo' },
    ],
    body:
      'NovaCell partnered with Axiom across two quarters to overhaul etch uniformity on their 7nm logic line. Starting baseline parametric yield was 61%, with a long tail of edge-die defects traced to chamber-edge plasma non-uniformity. Axiom deployed a co-tuned AX-Etch 600 with partner-specific recipe variants and introduced closed-loop sensor data into the calibration workflow. Within 14 weeks, yield reached 84%, and per-wafer cost dropped $412. The partnership continues to iterate on recipe optimization for upcoming 5nm ramp.',
    publishedAt: iso(18),
    featured: true,
  },
  {
    id: 's-002',
    slug: 'quantex-fab-runtime',
    title: 'Quantex recovers 112 hours of fab runtime per month',
    summary:
      'Predictive maintenance pipelines built on Axiom telemetry eliminated 72% of unscheduled downtime at Quantex’s Johor facility.',
    partner: 'Quantex Semiconductors',
    industry: 'Memory · DRAM',
    region: 'Malaysia',
    metrics: [
      { label: 'Downtime', value: '-72%' },
      { label: 'Runtime recovered', value: '112 hrs/mo' },
      { label: 'MTBF', value: '2.4× ↑' },
    ],
    body:
      'Quantex deployed Axiom’s telemetry SDK across 14 deposition tools, streaming vibration, chamber pressure, and power signatures into a shared anomaly-detection pipeline. Predictive maintenance windows replaced reactive interventions, and mean time between failures increased 2.4×.',
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
    metrics: [
      { label: 'QA hours', value: '-54%' },
      { label: 'Marginal catch', value: '+2×' },
      { label: 'Sites unified', value: '3' },
    ],
    body:
      'Aperture rolled out Axiom’s review viewer across three sites with shared rules and reviewer queues, reducing redundant QA and establishing a single source of truth for marginal die escalation.',
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
    slug: 'quickstart',
    title: 'Partner Portal Quickstart',
    category: 'Getting Started',
    excerpt: 'Set up your team, invite engineers, and connect your first tool in under 15 minutes.',
    body:
      '# Quickstart\n\nThis guide walks through the first 15 minutes of onboarding onto the Axiom partner portal. You will create your team, invite engineers, and connect your first tool via the telemetry SDK.\n\n## 1. Create your team\n\nOpen **Settings → Team** and invite colleagues by email. Partner role grants full portal access; admin role is reserved for internal Axiom staff.\n\n## 2. Connect a tool\n\nInstall the telemetry SDK on a workstation with network access to your tool controller. The SDK will negotiate a TLS channel to `ingest.axiom.sg` and stream shaped events only — no raw recipe data leaves your facility.\n\n## 3. Run your first calculator estimate\n\nUse the Score Calculator to estimate potential savings. Inputs are local to your session.',
    updatedAt: iso(6),
    readMin: 6,
  },
  {
    id: 'd-002',
    slug: 'zendesk-integration',
    title: 'Zendesk ticketing integration',
    category: 'Integrations',
    excerpt: 'How portal support and demo requests flow into Zendesk, and how to route by category.',
    body:
      '# Zendesk integration\n\nThe portal submits all support and demo requests to Zendesk via the Requests API. Category is used to populate the Zendesk group, and priority is mapped 1:1.',
    updatedAt: iso(14),
    readMin: 4,
  },
  {
    id: 'd-003',
    slug: 'calculator-logic',
    title: 'How the cost-savings calculator works',
    category: 'Best Practices',
    excerpt: 'The model, the inputs, the guardrails, and why estimates should be validated with a pilot run.',
    body:
      '# Calculator logic\n\nThe calculator combines baseline cost per wafer, process complexity, and an optimization factor to derive an expected savings envelope. Outputs are bounded estimates — always validate with a pilot run.',
    updatedAt: iso(3),
    readMin: 8,
  },
  {
    id: 'd-004',
    slug: 'api-overview',
    title: 'API overview',
    category: 'API',
    excerpt: 'Endpoints, authentication, rate limits, and versioning policy.',
    body: '# API overview\n\nREST endpoints live at `https://api.axiom.sg/v1`. Authentication is via scoped tokens.',
    updatedAt: iso(30),
    readMin: 10,
  },
  {
    id: 'd-005',
    slug: 'sla-policy',
    title: 'Support SLAs',
    category: 'Operations',
    excerpt: 'Response targets by priority tier for partner-tier accounts.',
    body:
      '# Support SLAs\n\n- Urgent: first response 1h, resolution target 8h\n- High: first response 4h, resolution target 1 business day\n- Normal: first response 1 business day\n- Low: first response 2 business days',
    updatedAt: iso(50),
    readMin: 3,
  },
  {
    id: 'd-006',
    slug: 'telemetry-sdk',
    title: 'Telemetry SDK reference',
    category: 'API',
    excerpt: 'Install, configure, and instrument the telemetry SDK for your tools.',
    body: '# Telemetry SDK\n\nThe SDK targets Python 3.10+ and Node 18+. It ships with connectors for the most common tool controllers.',
    updatedAt: iso(9),
    readMin: 12,
  },
  {
    id: 'd-007',
    slug: 'data-residency',
    title: 'Data residency & privacy',
    category: 'Operations',
    excerpt: 'Regional ingest, retention, and customer-managed key options.',
    body: '# Data residency\n\nAxiom operates ingest regions in Singapore, EU, and US. Data does not leave its ingest region by default.',
    updatedAt: iso(60),
    readMin: 5,
  },
  {
    id: 'd-008',
    slug: 'best-practice-pilots',
    title: 'Designing an effective pilot run',
    category: 'Best Practices',
    excerpt: 'Scoping, success metrics, and the two most common pilot failure modes.',
    body: '# Pilot design\n\nSuccessful pilots are narrow, measurable, and time-boxed. Two common failure modes: overly broad scope, and missing pre/post measurement.',
    updatedAt: iso(22),
    readMin: 7,
  },
]

export const seedInvoices: Invoice[] = [
  { id: 'INV-000142', periodStart: iso(30), periodEnd: iso(0), amount: 18450, status: 'open', issuedAt: iso(2) },
  { id: 'INV-000138', periodStart: iso(60), periodEnd: iso(31), amount: 17220, status: 'paid', issuedAt: iso(32) },
  { id: 'INV-000134', periodStart: iso(90), periodEnd: iso(61), amount: 17985, status: 'paid', issuedAt: iso(62) },
  { id: 'INV-000130', periodStart: iso(120), periodEnd: iso(91), amount: 16340, status: 'paid', issuedAt: iso(92) },
  { id: 'INV-000126', periodStart: iso(150), periodEnd: iso(121), amount: 15980, status: 'paid', issuedAt: iso(122) },
]

/* Calculator seed */
export const seedCalc: CalcConfig = {
  globals: {
    waferRevenue: 1100,
    laborRatePerHour: 58,
    energyCostPerKWh: 0.18,
    serviceFeePct: 0.18,
  },
  machines: [
    {
      id: 'mch-ax-litho-900',
      name: 'AX-Litho 900',
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
      id: 'mch-ax-etch-600',
      name: 'AX-Etch 600',
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
      id: 'mch-ax-dep-300',
      name: 'AX-Depose 300',
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
      id: 'mch-ax-insp-v5',
      name: 'AX-Inspect V5',
      family: 'Inspection',
      node: 'All nodes',
      baselineCostPerWafer: 180,
      defaultThroughput: 220,
      params: [
        { key: 'defectThresholdNm', label: 'Defect threshold', unit: 'nm', default: 22, min: 8, max: 80, step: 1 },
      ],
    },
    {
      id: 'mch-ax-metro-pro',
      name: 'AX-Metro Pro',
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
      compatibleMachines: ['mch-ax-litho-900', 'mch-ax-metro-pro'],
    },
    {
      id: 'p-etch-unif',
      name: 'Etch uniformity recipe',
      stepCount: 5,
      complexity: 3,
      optimizationFactor: 0.22,
      yieldUpliftPct: 3.1,
      compatibleMachines: ['mch-ax-etch-600'],
    },
    {
      id: 'p-film-control',
      name: 'Film thickness control',
      stepCount: 4,
      complexity: 2,
      optimizationFactor: 0.14,
      yieldUpliftPct: 1.6,
      compatibleMachines: ['mch-ax-dep-300', 'mch-ax-metro-pro'],
    },
    {
      id: 'p-defect-triage',
      name: 'Defect triage automation',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.11,
      yieldUpliftPct: 1.1,
      compatibleMachines: ['mch-ax-insp-v5', 'mch-ax-metro-pro'],
    },
    {
      id: 'p-throughput',
      name: 'Throughput co-optimization',
      stepCount: 4,
      complexity: 3,
      optimizationFactor: 0.15,
      yieldUpliftPct: 0.8,
      compatibleMachines: ['mch-ax-litho-900', 'mch-ax-etch-600', 'mch-ax-dep-300'],
    },
    {
      id: 'p-predictive-maint',
      name: 'Predictive maintenance',
      stepCount: 3,
      complexity: 2,
      optimizationFactor: 0.09,
      yieldUpliftPct: 0.5,
      compatibleMachines: ['mch-ax-etch-600', 'mch-ax-dep-300', 'mch-ax-litho-900'],
    },
  ],
}
