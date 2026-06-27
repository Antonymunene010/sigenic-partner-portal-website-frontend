/**
 * Authoritative demo seed for the Sigenic Partner Portal.
 *
 * Seeded once into an empty database (see store.init). Covers every PRD entity and
 * exercises all four organisation types and all eight roles so the permission
 * matrix and company-level isolation can be demonstrated end-to-end.
 *
 * IDs are fixed, readable strings so foreign keys wire up deterministically and
 * re-seeding stays stable. Default password for every demo account is `demo`
 * (overridable via SEED_DEFAULT_PASSWORD).
 */

const iso = (d: string) => new Date(d).toISOString()

export const SEED = {
  /* ---------- organisations ---------- */
  companies: [
    {
      id: 'co-sigenic',
      company_name: 'Sigenic',
      company_code: 'SIGENIC',
      company_type: 'sigenic',
      parent_company_id: null,
      status: 'active',
      industry: 'Semiconductor AI / Quality Intelligence',
      onboarding_status: 'live',
      permissions: {},
    },
    {
      id: 'co-apac',
      company_name: 'APAC Semiconductor Partners',
      company_code: 'APAC',
      company_type: 'distributor',
      parent_company_id: null,
      status: 'active',
      industry: 'Distribution / Channel',
      onboarding_status: 'live',
      permissions: { calculator: true, case_studies: true, service_requests: true, knowledge_base: true, billing: false },
    },
    {
      id: 'co-novacell',
      company_name: 'NovaCell Systems',
      company_code: 'NOVACELL',
      company_type: 'customer',
      parent_company_id: 'co-apac', // managed via distributor
      status: 'active',
      industry: 'Memory / DRAM',
      zendesk_org_id: '900001',
      billing_contact_name: 'Karen Lim',
      billing_contact_email: 'karen@novacell.sg',
      onboarding_status: 'live',
      onboarding_milestones: [
        { key: 'created', label: 'Partner account created', done: true },
        { key: 'kickoff', label: 'Kickoff completed', done: true },
        { key: 'training', label: 'Training completed', done: true },
        { key: 'data_access', label: 'Data access granted', done: true },
        { key: 'zendesk', label: 'Zendesk access enabled', done: true },
        { key: 'calculator', label: 'Calculator enabled', done: true },
        { key: 'first_story', label: 'First case study shared', done: false },
      ],
      service_tier: 'Partner Plus',
      subscription_type: 'Annual',
      trial: false,
      contract_start: '2025-09-01',
      renewal_date: '2026-09-01',
      permissions: { calculator: true, case_studies: true, service_requests: true, knowledge_base: true, billing: true },
    },
    {
      id: 'co-quantex',
      company_name: 'Quantex Semiconductors',
      company_code: 'QUANTEX',
      company_type: 'customer',
      parent_company_id: null, // direct customer
      status: 'active',
      industry: 'Logic / Foundry',
      zendesk_org_id: '900002',
      billing_contact_name: 'Daniel Ong',
      billing_contact_email: 'daniel@quantex.com',
      onboarding_status: 'accepted',
      onboarding_milestones: [
        { key: 'created', label: 'Partner account created', done: true },
        { key: 'kickoff', label: 'Kickoff completed', done: true },
        { key: 'training', label: 'Training completed', done: false },
        { key: 'data_access', label: 'Data access granted', done: true },
        { key: 'zendesk', label: 'Zendesk access enabled', done: false },
        { key: 'calculator', label: 'Calculator enabled', done: true },
        { key: 'first_story', label: 'First case study shared', done: false },
      ],
      service_tier: 'Partner',
      subscription_type: 'Annual',
      trial: false,
      contract_start: '2026-01-15',
      renewal_date: '2027-01-15',
      permissions: { calculator: true, case_studies: true, service_requests: true, knowledge_base: true, billing: true },
    },
    {
      id: 'co-aperture',
      company_name: 'Aperture Wafer Co.',
      company_code: 'APERTURE',
      company_type: 'customer',
      parent_company_id: null,
      status: 'pending_invite',
      industry: 'Compound Semiconductor',
      onboarding_status: 'invited',
      service_tier: 'Trial',
      subscription_type: 'Trial',
      trial: true,
      permissions: { calculator: true, case_studies: true, service_requests: true, knowledge_base: true, billing: false },
    },
  ],

  sites: [
    { id: 'site-novacell-sg', company_id: 'co-novacell', site_name: 'Tampines Fab 1', site_code: 'NC-SG1', location: 'Singapore', status: 'active' },
    { id: 'site-novacell-my', company_id: 'co-novacell', site_name: 'Kulim Fab 2', site_code: 'NC-MY2', location: 'Kulim, Malaysia', status: 'active' },
    { id: 'site-quantex-tw', company_id: 'co-quantex', site_name: 'Hsinchu Fab', site_code: 'QX-TW1', location: 'Hsinchu, Taiwan', status: 'active' },
    { id: 'site-aperture-us', company_id: 'co-aperture', site_name: 'Austin Pilot Line', site_code: 'AP-US1', location: 'Austin, USA', status: 'active' },
  ],

  /* ---------- users (all 8 roles) ---------- */
  users: [
    { id: 'u-bernard', company_id: 'co-sigenic', full_name: 'Bernard Soh', email: 'founder-demo@sigenic.com', user_type: 'internal', role: 'super_admin', status: 'active' },
    { id: 'u-priya', company_id: 'co-sigenic', full_name: 'Priya Nair', email: 'admin-demo@sigenic.com', user_type: 'internal', role: 'admin', status: 'active' },
    { id: 'u-sam', company_id: 'co-sigenic', full_name: 'Sam Okafor', email: 'support-demo@sigenic.com', user_type: 'internal', role: 'support_engineer', status: 'active' },
    { id: 'u-dewi', company_id: 'co-apac', full_name: 'Dewi Anggraini', email: 'admin@apacpartners.com', user_type: 'distributor', role: 'distributor_admin', status: 'active' },
    { id: 'u-leo', company_id: 'co-apac', full_name: 'Leo Tan', email: 'leo@apacpartners.com', user_type: 'distributor', role: 'distributor_user', status: 'active' },
    { id: 'u-karen', company_id: 'co-novacell', site_id: 'site-novacell-sg', full_name: 'Karen Lim', email: 'karen@novacell.sg', user_type: 'customer', role: 'customer_admin', status: 'active' },
    { id: 'u-wei', company_id: 'co-novacell', site_id: 'site-novacell-sg', full_name: 'Wei Tan', email: 'wei@novacell.sg', user_type: 'customer', role: 'customer_user', status: 'active' },
    { id: 'u-daniel', company_id: 'co-quantex', site_id: 'site-quantex-tw', full_name: 'Daniel Ong', email: 'daniel@quantex.com', user_type: 'customer', role: 'customer_admin', status: 'active' },
    { id: 'u-mara', company_id: 'co-quantex', site_id: 'site-quantex-tw', full_name: 'Mara Velasco', email: 'mara@quantex.com', user_type: 'customer', role: 'customer_user', status: 'invited' },
  ],

  /* ---------- master data: departments → processes → machines ---------- */
  // Departments = the Risk & Yield Loss Simulator templates (one per spreadsheet
  // sheet). `technology` drives the default per-wafer price.
  departments: [
    { id: 'dep-wet-cmp', name: 'WET — Post CMP Clean', code: 'WET-CMP', description: 'WET single-wafer process — post-CMP clean (AS2000 or equivalent).', technology: '200mm' },
    { id: 'dep-litho-scanner', name: 'Litho — Scanner', code: 'LITHO', description: 'Lithography scanner / stepper line with laminar cap pump.', technology: '200mm' },
    { id: 'dep-wet-chem', name: 'WET — Chem Concentration', code: 'WET-CHEM', description: 'WET single-wafer process — chemical concentration monitoring (LAM EOS or equivalent).', technology: '300mm' },
    { id: 'dep-implant', name: 'IMPLANT — Aligner', code: 'IMPLANT', description: 'Ion implant single-wafer process — aligner (Axcelis VIISion).', technology: '200mm' },
    { id: 'dep-cvd', name: 'CVD / PVD / ETCH', code: 'CVD-PVD-ETCH', description: 'CVD/PVD/ETCH chambers (AMAT Producer / Centura).', technology: '200mm' },
  ],

  // The simulator is keyed by department + machine; processes are unused (the
  // taxonomy comes straight from the spreadsheet's sheets).
  processes: [],

  machines: [
    { id: 'mac-as2000', department_id: 'dep-wet-cmp', machine_name: 'AS2000', machine_code: 'AS2000', machine_category: 'WET single wafer', model: 'AS2000 or equivalent' },
    { id: 'mac-litho-scanner', department_id: 'dep-litho-scanner', machine_name: 'Scanner / Stepper', machine_code: 'SCANNER', machine_category: 'Litho', model: 'Scanner, Stepper' },
    { id: 'mac-litho-pump', department_id: 'dep-litho-scanner', machine_name: 'Laminar Cap Pump', machine_code: 'LCP', machine_category: 'Auxiliary', model: 'Laminar cap pump' },
    { id: 'mac-lam-eos', department_id: 'dep-wet-chem', machine_name: 'LAM EOS', machine_code: 'LAMEOS', machine_category: 'WET single wafer', vendor: 'Lam Research', model: 'EOS or equivalent' },
    { id: 'mac-viision', department_id: 'dep-implant', machine_name: 'Axcelis VIISion', machine_code: 'VIISION', machine_category: 'Implant aligner', vendor: 'Axcelis', model: 'VIISion' },
    { id: 'mac-amat-producer', department_id: 'dep-cvd', machine_name: 'AMAT Producer', machine_code: 'PRODUCER', machine_category: 'CVD/PVD/ETCH', vendor: 'Applied Materials', model: 'Producer (200mm) or equivalent' },
    { id: 'mac-amat-centura', department_id: 'dep-cvd', machine_name: 'AMAT Centura', machine_code: 'CENTURA', machine_category: 'CVD/PVD/ETCH', vendor: 'Applied Materials', model: 'Centura (200mm) or equivalent' },
  ],

  /* ---------- scoring model + issue catalog + configuration ---------- */
  scoring_models: [
    { id: 'sm-v1', version_name: 'Risk & Yield Loss v1.0', description: 'Risk score + annual yield-loss model per the Sigenic Risk Score & Yield Loss Simulator.', status: 'active', effective_from: '2026-01-01', created_by: 'u-priya' },
    { id: 'sm-v2', version_name: 'Risk & Yield Loss v2.0 (draft)', description: 'Draft revision of the issue catalog. Not yet active.', status: 'draft', effective_from: '2026-07-01', created_by: 'u-priya' },
  ],

  // Issue catalog — the questionnaire rows per department/template (sm-v1).
  // Defaults pre-fill the calculator with the spreadsheet's example inputs.
  calculator_issues: [
    // WET — Post CMP Clean (200mm)
    { id: 'iss-wetcmp-1', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'Brush Torque unstable (DBC/TBC)', default_severity: 2000, default_occurrence: 0.25, default_detection: 'system', sort_order: 1 },
    { id: 'iss-wetcmp-2', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'DIW flow pressure (LD/DBC/TBC/DTC)', default_severity: 5888, default_occurrence: 1, default_detection: 'unable', sort_order: 2 },
    { id: 'iss-wetcmp-3', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'Chem flow rate', default_severity: 10000, default_occurrence: 0.5, default_detection: 'unable', sort_order: 3 },
    { id: 'iss-wetcmp-4', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'Exhaust pressure (DBC/TBC/DTC)', default_severity: 1500, default_occurrence: 2, default_detection: 'system', sort_order: 4 },
    { id: 'iss-wetcmp-5', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'Vacuum level: MT1/2/3', default_severity: 1500, default_occurrence: 2, default_detection: 'partial', sort_order: 5 },
    { id: 'iss-wetcmp-6', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'N2 Flow rate', default_severity: 1000, default_occurrence: 4, default_detection: 'unable', sort_order: 6 },
    { id: 'iss-wetcmp-7', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'N2 Temp', default_severity: 1000, default_occurrence: 2, default_detection: 'system', sort_order: 7 },
    { id: 'iss-wetcmp-8', scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', label: 'Other issue', default_severity: 2000, default_occurrence: 0.5, default_detection: 'system', sort_order: 8 },
    // Litho — Scanner (200mm)
    { id: 'iss-litho-1', scoring_model_id: 'sm-v1', department_id: 'dep-litho-scanner', label: 'Light leak', default_severity: 2342, default_occurrence: 0.25, default_detection: 'unable', sort_order: 1 },
    { id: 'iss-litho-2', scoring_model_id: 'sm-v1', department_id: 'dep-litho-scanner', label: 'Other issue', sort_order: 2 },
    // WET — Chem Concentration (300mm)
    { id: 'iss-wetchem-1', scoring_model_id: 'sm-v1', department_id: 'dep-wet-chem', label: 'Chemical concentration monitoring', default_severity: 1000, default_occurrence: 3, default_detection: 'partial', sort_order: 1 },
    { id: 'iss-wetchem-2', scoring_model_id: 'sm-v1', department_id: 'dep-wet-chem', label: 'Other issue', default_severity: 1000, default_occurrence: 5, default_detection: 'unable', sort_order: 2 },
    // IMPLANT — Aligner (200mm)
    { id: 'iss-implant-1', scoring_model_id: 'sm-v1', department_id: 'dep-implant', label: 'Aligner scratching wafer edge', default_detection: 'system', sort_order: 1 },
    { id: 'iss-implant-2', scoring_model_id: 'sm-v1', department_id: 'dep-implant', label: 'Other issue', default_detection: 'system', sort_order: 2 },
    // CVD / PVD / ETCH (200mm)
    { id: 'iss-cvd-1', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Transfer Module: FI Robot unstable issue', default_occurrence: 0.25, default_detection: 'system', sort_order: 1 },
    { id: 'iss-cvd-2', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Transfer Module (Vacuum): Buffer robot / VTM leveling issue', default_occurrence: 4, default_detection: 'partial', sort_order: 2 },
    { id: 'iss-cvd-3', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'FFU: Hepa pressure', sort_order: 3 },
    { id: 'iss-cvd-4', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Load Lock: Platform leveling', sort_order: 4 },
    { id: 'iss-cvd-5', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Load Lock: Mapping (Lose Step)', sort_order: 5 },
    { id: 'iss-cvd-6', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Chamber: Lifter pin vibration', default_detection: 'partial', sort_order: 6 },
    { id: 'iss-cvd-7', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Chamber: Heater vibration', default_detection: 'unable', sort_order: 7 },
    { id: 'iss-cvd-8', scoring_model_id: 'sm-v1', department_id: 'dep-cvd', label: 'Chiller: PCW flow rate', default_detection: 'system', sort_order: 8 },
  ],

  // Configuration tab: occurrence (events/yr) → score (identity by default).
  occurrence_options: [
    { id: 'occ-025', value: 0.25, score: 0.25, label: '0.25 / yr', sort_order: 1 },
    { id: 'occ-05', value: 0.5, score: 0.5, label: '0.5 / yr', sort_order: 2 },
    { id: 'occ-1', value: 1, score: 1, label: '1 / yr', sort_order: 3 },
    { id: 'occ-2', value: 2, score: 2, label: '2 / yr', sort_order: 4 },
    { id: 'occ-3', value: 3, score: 3, label: '3 / yr', sort_order: 5 },
    { id: 'occ-4', value: 4, score: 4, label: '4 / yr', sort_order: 6 },
    { id: 'occ-5', value: 5, score: 5, label: '5 / yr', sort_order: 7 },
  ],

  // Configuration tab: detection capability → score.
  detection_options: [
    { id: 'det-unable', key: 'unable', label: 'Unable to Detect', score: 5, sort_order: 1 },
    { id: 'det-partial', key: 'partial', label: 'Able to detect but not integrated to system', score: 3, sort_order: 2 },
    { id: 'det-system', key: 'system', label: 'Able to detect by system', score: 1, sort_order: 3 },
  ],

  // Configuration tab: technology → wafer price band (avg = default per-wafer value).
  technology_prices: [
    { id: 'tp-200', technology: '200mm', label: '$600–$900 (Europe)', min_price: 600, avg_price: 750, max_price: 900, currency: 'USD' },
    { id: 'tp-300', technology: '300mm', label: '$1,650–$3,984 (Europe)', min_price: 1650, avg_price: 2817, max_price: 3984, currency: 'USD' },
  ],

  /* ---------- success stories (public case studies) ---------- */
  success_stories: [
    {
      id: 'story-novacell', slug: 'novacell-yield', title: 'NovaCell lifts EUV yield 38% in one quarter',
      summary: 'How a DRAM fab cut overlay excursions and recovered millions in scrapped wafers using the Sigenic Care program.',
      partner: 'NovaCell Systems', industry: 'Memory / DRAM', region: 'Singapore', theme: 'yield',
      metrics_json: [{ label: 'Yield uplift', value: '+38%' }, { label: 'Cost / wafer', value: '-$412' }, { label: 'Payback', value: '4.1 mo' }],
      before_json: [{ label: 'Yield', value: '82%' }, { label: 'Excursions / qtr', value: '6' }],
      after_json: [{ label: 'Yield', value: '92%' }, { label: 'Excursions / qtr', value: '1' }],
      body: 'NovaCell faced recurring overlay drift on its EUV line...\n\nWith Sigenic real-time detection the team caught excursions within hours instead of days, recovering an estimated $4.9M annually.',
      status: 'published', featured: true, visibility: 'public', published_at: iso('2026-03-12'),
    },
    {
      id: 'story-quantex', slug: 'quantex-excursion', title: 'Quantex prevents a $2.4M etch excursion',
      summary: 'Early plasma non-uniformity detection on a logic foundry line avoided a full-lot scrap event.',
      partner: 'Quantex Semiconductors', industry: 'Logic / Foundry', region: 'Taiwan', theme: 'excursion',
      metrics_json: [{ label: 'Loss avoided', value: '$2.4M' }, { label: 'Detection lead time', value: '4 hr' }],
      before_json: [{ label: 'Detection', value: '2 days' }], after_json: [{ label: 'Detection', value: '4 hours' }],
      body: 'A subtle chamber drift was flagged by the Sigenic model before it propagated across the lot...',
      status: 'published', featured: true, visibility: 'public', published_at: iso('2026-02-20'),
    },
    {
      id: 'story-aperture', slug: 'aperture-qa', title: 'Aperture cuts manual QA hours 54%',
      summary: 'Automated defect triage freed an entire shift of metrology engineers.',
      partner: 'Aperture Wafer Co.', industry: 'Compound Semiconductor', region: 'USA', theme: 'throughput',
      metrics_json: [{ label: 'QA hours', value: '-54%' }, { label: 'Marginal catch', value: '2×' }],
      before_json: [], after_json: [],
      body: 'Aperture replaced manual defect classification with the Sigenic inspection model...',
      status: 'published', featured: false, visibility: 'public', published_at: iso('2026-01-30'),
    },
  ],

  /* ---------- knowledge base ---------- */
  knowledge_articles: [
    { id: 'kb-euv-drift', slug: 'euv-overlay-drift', source_type: 'portal', title: 'Known issue: EUV overlay drift on firmware 2.4.1', summary: 'Workaround for the overlay drift regression introduced in scanner firmware 2.4.1.', category: 'Known Issues', tags_json: ['euv', 'overlay', 'firmware'], body: 'Symptoms: gradual overlay drift after 2.4.1...\n\nWorkaround: pin firmware to 2.4.0 and recalibrate every 24h until 2.4.2.', featured: true, audience_type: 'all', last_reviewed_at: iso('2026-04-10') },
    { id: 'kb-plasma', slug: 'plasma-non-uniformity', source_type: 'portal', title: 'Troubleshooting plasma non-uniformity on etch', summary: 'Step-by-step diagnosis for chamber non-uniformity.', category: 'Troubleshooting', tags_json: ['etch', 'plasma'], body: '1. Check RF match...\n2. Inspect electrode wear...', featured: false, audience_type: 'all', last_reviewed_at: iso('2026-03-22') },
    { id: 'kb-calc-logic', slug: 'calculator-assumptions', source_type: 'portal', title: 'SOP: Risk score & yield-loss calculator logic', summary: 'How the calculator derives per-issue risk scores and the annual yield loss.', category: 'Best Practices', tags_json: ['calculator', 'risk', 'yield'], body: 'For each issue you enter severity (pcs of affected wafers), occurrence (events per year) and detection capability. The risk score = severity score (min(log10(severity)·1.5, 5)) + occurrence score + detection score, banded as High (9–15), Medium (4–8) or Low (1–3). Annual yield loss = Σ(severity × occurrence) × wafer price, where the wafer price is your input or the technology average from the Configuration tab.', featured: true, audience_type: 'all', last_reviewed_at: iso('2026-04-01') },
    { id: 'kb-billing', slug: 'billing-faq', source_type: 'portal', title: 'FAQ: Billing & invoices', summary: 'Common billing questions for partner accounts.', category: 'FAQs', tags_json: ['billing'], body: 'Invoices are issued monthly...', featured: false, audience_type: 'customer', last_reviewed_at: iso('2026-02-15') },
    { id: 'kb-access', slug: 'portal-access', source_type: 'portal', title: 'FAQ: Portal access & roles', summary: 'Who can do what in the partner portal.', category: 'FAQs', tags_json: ['access', 'roles'], body: 'Roles are split by organisation type and permission...', featured: false, audience_type: 'all', last_reviewed_at: iso('2026-03-01') },
    { id: 'kb-pilot', slug: 'pilot-design', source_type: 'portal', title: 'Best practices: Designing a Sigenic pilot', summary: 'How to scope a high-signal pilot in 30 days.', category: 'Best Practices', tags_json: ['pilot', 'onboarding'], body: 'Pick one tool family and one excursion mode...', featured: false, audience_type: 'all', last_reviewed_at: iso('2026-03-18') },
  ],

  /* ---------- announcements (audience-targeted) ---------- */
  announcements: [
    { id: 'ann-v2', title: 'ROI Model v2.0 entering pilot', body: 'A new scoring model with improved EUV detection weighting is in draft. Internal review opens next week.', audience_type: 'internal', pinned: true, created_by: 'u-priya', publish_at: iso('2026-05-20') },
    { id: 'ann-maint', title: 'Scheduled maintenance — SG ingest', body: 'The Singapore ingest cluster will be briefly unavailable on Sunday 02:00–03:00 SGT.', audience_type: 'all', pinned: false, created_by: 'u-priya', publish_at: iso('2026-05-25') },
    { id: 'ann-webinar', title: 'Distributor enablement webinar', body: 'Join our pre-sales calculator deep-dive for channel partners.', audience_type: 'distributor', pinned: false, created_by: 'u-priya', publish_at: iso('2026-05-15') },
  ],

  /* ---------- request-form taxonomy (super-admin configurable, decoupled from the calculator) ---------- */
  request_types: [
    { id: 'rt-support', slug: 'support', label: 'Support', owner_team: 'support', blurb: 'A technical issue routed to Zendesk.', sort_order: 1 },
    { id: 'rt-demo', slug: 'demo', label: 'Demo', owner_team: 'sales', blurb: 'Request a product walkthrough.', sort_order: 2 },
    { id: 'rt-consultation', slug: 'consultation', label: 'Consultation', owner_team: 'sales', blurb: 'Scope a pilot or ROI review.', sort_order: 3 },
    { id: 'rt-onboarding', slug: 'onboarding', label: 'Onboarding', owner_team: 'ops', blurb: 'Kickoff, training or access setup.', sort_order: 4 },
    { id: 'rt-feature', slug: 'feature_request', label: 'Feature request', owner_team: 'product', blurb: 'Suggest a product improvement.', sort_order: 5 },
  ],

  // Independent request taxonomy — NOT the calculator's departments/processes/machines.
  request_departments: [
    { id: 'rdep-cmp', name: 'CMP / Post-CMP Clean', code: 'CMP', sort_order: 1 },
    { id: 'rdep-litho', name: 'Lithography', code: 'LITHO', sort_order: 2 },
    { id: 'rdep-cvd', name: 'CVD / PVD / ETCH', code: 'CVD', sort_order: 3 },
    { id: 'rdep-metro', name: 'Metrology / Inspection', code: 'METRO', sort_order: 4 },
    { id: 'rdep-other', name: 'Other / General', code: 'GEN', sort_order: 5 },
  ],

  request_processes: [
    { id: 'rproc-clean', request_department_id: 'rdep-cmp', process_name: 'Post-CMP clean', process_code: 'CLEAN', sort_order: 1 },
    { id: 'rproc-scan', request_department_id: 'rdep-litho', process_name: 'Scanner / Stepper', process_code: 'SCAN', sort_order: 1 },
    { id: 'rproc-etch', request_department_id: 'rdep-cvd', process_name: 'Etch', process_code: 'ETCH', sort_order: 1 },
  ],

  request_machines: [
    { id: 'rmac-as2000', request_department_id: 'rdep-cmp', request_process_id: 'rproc-clean', machine_name: 'AS2000', machine_code: 'AS2000', machine_category: 'WET single wafer', sort_order: 1 },
    { id: 'rmac-amat', request_department_id: 'rdep-cvd', request_process_id: 'rproc-etch', machine_name: 'AMAT Producer', machine_code: 'PRODUCER', machine_category: 'CVD/PVD/ETCH', vendor: 'Applied Materials', sort_order: 1 },
    { id: 'rmac-scanner', request_department_id: 'rdep-litho', request_process_id: 'rproc-scan', machine_name: 'Scanner / Stepper', machine_code: 'SCANNER', machine_category: 'Litho', sort_order: 1 },
  ],

  /* ---------- service requests ---------- */
  service_requests: [
    { id: 'sr-001', company_id: 'co-novacell', site_id: 'site-novacell-sg', user_id: 'u-wei', request_type: 'support', title: 'Brush torque (DBC/TBC) instability on AS2000', description: 'Recurring brush torque instability after the last PM on the post-CMP clean tool.', department_id: 'rdep-cmp', machine_id: 'rmac-as2000', urgency: 'high', status: 'open', source: 'portal_form', owner_team: 'support', contact_name: 'Wei Tan', contact_email: 'wei@novacell.sg', messages: [{ id: 'm1', author: 'Wei Tan', authorRole: 'you', body: 'Brush torque keeps drifting after the last PM.', createdAt: iso('2026-05-21') }, { id: 'm2', author: 'Sigenic Support', authorRole: 'agent', body: 'Thanks Wei — let us review the DBC/TBC torque logs. Tracking as ticket #4101.', createdAt: iso('2026-05-21') }] },
    { id: 'sr-002', company_id: 'co-quantex', site_id: 'site-quantex-tw', user_id: 'u-daniel', request_type: 'consultation', title: 'Scope a pilot on the CVD/PVD/ETCH line', description: 'Would like to discuss a 30-day pilot for chamber excursion detection.', department_id: 'rdep-cvd', urgency: 'medium', status: 'open', source: 'calculator_cta', owner_team: 'sales', contact_name: 'Daniel Ong', contact_email: 'daniel@quantex.com' },
    { id: 'sr-003', company_id: 'co-apac', user_id: 'u-leo', request_type: 'demo', title: 'Demo request for prospective customer', description: 'Channel customer wants to see the calculator + inspection workflow.', urgency: 'medium', status: 'new', source: 'portal_form', owner_team: 'sales', contact_name: 'Leo Tan', contact_email: 'leo@apacpartners.com' },
    { id: 'sr-004', company_id: 'co-novacell', user_id: 'u-karen', request_type: 'feature_request', title: 'Batch upload of historical runs', description: 'Ability to bulk import past calculator runs from CSV.', urgency: 'low', status: 'new', source: 'dashboard', owner_team: 'product', contact_name: 'Karen Lim', contact_email: 'karen@novacell.sg' },
    { id: 'sr-005', company_id: null, user_id: null, request_type: 'demo', title: 'Public demo request — Lumen Photonics', description: 'Interested in yield analytics for a new GaN line.', urgency: 'medium', status: 'new', source: 'landing_page', owner_team: 'sales', contact_name: 'Aisha Rahman', contact_email: 'aisha@lumenphotonics.io', interest_type: 'ROI calculator' },
  ],

  /* ---------- invoices (billing visibility) ---------- */
  invoices: [
    { id: 'INV-000142', company_id: 'co-novacell', period_start: '2026-05-01', period_end: '2026-05-31', amount: 18450, status: 'open', issued_at: '2026-05-01', line_items_json: [{ description: 'Sigenic Care — Partner Plus (monthly)', amount: 16000 }, { description: 'Additional fab — Kulim Fab 2', amount: 2450 }] },
    { id: 'INV-000138', company_id: 'co-novacell', period_start: '2026-04-01', period_end: '2026-04-30', amount: 16000, status: 'paid', issued_at: '2026-04-01', line_items_json: [{ description: 'Sigenic Care — Partner Plus (monthly)', amount: 16000 }] },
    { id: 'INV-000134', company_id: 'co-novacell', period_start: '2026-03-01', period_end: '2026-03-31', amount: 16000, status: 'paid', issued_at: '2026-03-01', line_items_json: [{ description: 'Sigenic Care — Partner Plus (monthly)', amount: 16000 }] },
    { id: 'INV-000211', company_id: 'co-quantex', period_start: '2026-05-01', period_end: '2026-05-31', amount: 12000, status: 'open', issued_at: '2026-05-01', line_items_json: [{ description: 'Sigenic Care — Partner (monthly)', amount: 12000 }] },
  ],

  /* ---------- calculator runs (saved) ---------- */
  calculator_runs: [
    {
      id: 'run-001', company_id: 'co-novacell', site_id: 'site-novacell-sg', user_id: 'u-wei', run_type: 'partner',
      scoring_model_id: 'sm-v1', department_id: 'dep-wet-cmp', machine_id: 'mac-as2000',
      technology: '200mm', wafer_value: 750, price_source: 'technology_average',
      overall_risk_score: 13.5, overall_tier: 'high',
      total_annual_wafer_loss: 24388, total_annual_value_loss: 18291000,
      inputs_json: [
        { issueId: 'iss-wetcmp-1', severity: 2000, occurrence: 0.25, detection: 'system' },
        { issueId: 'iss-wetcmp-2', severity: 5888, occurrence: 1, detection: 'unable' },
        { issueId: 'iss-wetcmp-3', severity: 10000, occurrence: 0.5, detection: 'unable' },
        { issueId: 'iss-wetcmp-4', severity: 1500, occurrence: 2, detection: 'system' },
        { issueId: 'iss-wetcmp-5', severity: 1500, occurrence: 2, detection: 'partial' },
        { issueId: 'iss-wetcmp-6', severity: 1000, occurrence: 4, detection: 'unable' },
        { issueId: 'iss-wetcmp-7', severity: 1000, occurrence: 2, detection: 'system' },
        { issueId: 'iss-wetcmp-8', severity: 2000, occurrence: 0.5, detection: 'system' },
      ],
      output_summary_json: { overallRiskScore: 13.5, overallTier: 'high', totalAnnualWaferLoss: 24388, totalAnnualValueLoss: 18291000, technology: '200mm', currency: 'USD' },
    },
  ],

  /* ---------- audit log ---------- */
  audit_logs: [
    { id: 'al-1', user_id: 'u-priya', actor_name: 'Priya Nair', entity_type: 'scoring_model', entity_id: 'sm-v1', action: 'activate', new_value_json: { status: 'active' } },
    { id: 'al-2', user_id: 'u-priya', actor_name: 'Priya Nair', entity_type: 'company', entity_id: 'co-quantex', action: 'create', new_value_json: { company_name: 'Quantex Semiconductors' } },
    { id: 'al-3', user_id: 'u-bernard', actor_name: 'Bernard Soh', entity_type: 'machine', entity_id: 'mac-as2000', action: 'create', new_value_json: { machine_name: 'AS2000' } },
  ],
}
