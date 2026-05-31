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
      onboarding_status: 'fully_onboarded',
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
      onboarding_status: 'fully_onboarded',
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
      onboarding_status: 'fully_onboarded',
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
      onboarding_status: 'in_progress',
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
      status: 'prospect',
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
    { id: 'u-bernard', company_id: 'co-sigenic', full_name: 'Bernard Soh', email: 'founder@sigenic.com', user_type: 'internal', role: 'super_admin', status: 'active' },
    { id: 'u-priya', company_id: 'co-sigenic', full_name: 'Priya Nair', email: 'admin@sigenic.com', user_type: 'internal', role: 'admin', status: 'active' },
    { id: 'u-sam', company_id: 'co-sigenic', full_name: 'Sam Okafor', email: 'support@sigenic.com', user_type: 'internal', role: 'support_engineer', status: 'active' },
    { id: 'u-dewi', company_id: 'co-apac', full_name: 'Dewi Anggraini', email: 'admin@apacpartners.com', user_type: 'distributor', role: 'distributor_admin', status: 'active' },
    { id: 'u-leo', company_id: 'co-apac', full_name: 'Leo Tan', email: 'leo@apacpartners.com', user_type: 'distributor', role: 'distributor_user', status: 'active' },
    { id: 'u-karen', company_id: 'co-novacell', site_id: 'site-novacell-sg', full_name: 'Karen Lim', email: 'karen@novacell.sg', user_type: 'customer', role: 'customer_admin', status: 'active' },
    { id: 'u-wei', company_id: 'co-novacell', site_id: 'site-novacell-sg', full_name: 'Wei Tan', email: 'wei@novacell.sg', user_type: 'customer', role: 'customer_user', status: 'active' },
    { id: 'u-daniel', company_id: 'co-quantex', site_id: 'site-quantex-tw', full_name: 'Daniel Ong', email: 'daniel@quantex.com', user_type: 'customer', role: 'customer_admin', status: 'active' },
    { id: 'u-mara', company_id: 'co-quantex', site_id: 'site-quantex-tw', full_name: 'Mara Velasco', email: 'mara@quantex.com', user_type: 'customer', role: 'customer_user', status: 'invited' },
  ],

  /* ---------- master data: departments → processes → machines ---------- */
  departments: [
    { id: 'dep-litho', name: 'Lithography', code: 'LITHO', description: 'Pattern transfer onto the wafer.' },
    { id: 'dep-etch', name: 'Etch', code: 'ETCH', description: 'Selective material removal.' },
    { id: 'dep-cmp', name: 'CMP', code: 'CMP', description: 'Chemical-mechanical planarisation.' },
    { id: 'dep-depo', name: 'Deposition', code: 'DEPO', description: 'Thin-film deposition (ALD/CVD/PVD).' },
    { id: 'dep-metro', name: 'Metrology & Inspection', code: 'METRO', description: 'Measurement, overlay and defect inspection.' },
  ],

  processes: [
    { id: 'proc-euv', department_id: 'dep-litho', process_name: 'EUV Patterning', process_code: 'EUV' },
    { id: 'proc-duv', department_id: 'dep-litho', process_name: 'DUV Immersion', process_code: 'DUVi' },
    { id: 'proc-plasma-etch', department_id: 'dep-etch', process_name: 'Plasma Etch', process_code: 'PE' },
    { id: 'proc-ale', department_id: 'dep-etch', process_name: 'Atomic Layer Etch', process_code: 'ALE' },
    { id: 'proc-oxide-cmp', department_id: 'dep-cmp', process_name: 'Oxide CMP', process_code: 'OXCMP' },
    { id: 'proc-ald', department_id: 'dep-depo', process_name: 'Atomic Layer Deposition', process_code: 'ALD' },
    { id: 'proc-pecvd', department_id: 'dep-depo', process_name: 'PECVD', process_code: 'PECVD' },
    { id: 'proc-overlay', department_id: 'dep-metro', process_name: 'Overlay Metrology', process_code: 'OVL' },
    { id: 'proc-defect', department_id: 'dep-metro', process_name: 'Defect Inspection', process_code: 'DEF' },
  ],

  machines: [
    { id: 'mac-euv-3600', department_id: 'dep-litho', process_id: 'proc-euv', machine_name: 'EUV Scanner NXE-3600', machine_code: 'NXE3600', machine_category: 'Scanner', vendor: 'ASML', model: 'NXE:3600D' },
    { id: 'mac-duv-2050', department_id: 'dep-litho', process_id: 'proc-duv', machine_name: 'DUV Immersion 2050i', machine_code: 'NXT2050', machine_category: 'Scanner', vendor: 'ASML', model: 'NXT:2050i' },
    { id: 'mac-etch-pri', department_id: 'dep-etch', process_id: 'proc-plasma-etch', machine_name: 'Centura Plasma Etch', machine_code: 'CENT-ETCH', machine_category: 'Etcher', vendor: 'Applied Materials', model: 'Centura' },
    { id: 'mac-ale-x', department_id: 'dep-etch', process_id: 'proc-ale', machine_name: 'Kiyo ALE', machine_code: 'KIYO', machine_category: 'Etcher', vendor: 'Lam Research', model: 'Kiyo' },
    { id: 'mac-cmp-reflexion', department_id: 'dep-cmp', process_id: 'proc-oxide-cmp', machine_name: 'Reflexion CMP', machine_code: 'REFLEX', machine_category: 'Polisher', vendor: 'Applied Materials', model: 'Reflexion LK' },
    { id: 'mac-ald-pulsar', department_id: 'dep-depo', process_id: 'proc-ald', machine_name: 'Pulsar ALD', machine_code: 'PULSAR', machine_category: 'Deposition', vendor: 'ASM', model: 'Pulsar' },
    { id: 'mac-pecvd-producer', department_id: 'dep-depo', process_id: 'proc-pecvd', machine_name: 'Producer PECVD', machine_code: 'PROD-CVD', machine_category: 'Deposition', vendor: 'Applied Materials', model: 'Producer GT' },
    { id: 'mac-overlay-yieldstar', department_id: 'dep-metro', process_id: 'proc-overlay', machine_name: 'YieldStar Overlay', machine_code: 'YSTAR', machine_category: 'Metrology', vendor: 'ASML', model: 'YieldStar 1385' },
    { id: 'mac-defect-2935', department_id: 'dep-metro', process_id: 'proc-defect', machine_name: 'Defect Inspector 2935', machine_code: 'INS2935', machine_category: 'Inspection', vendor: 'KLA', model: '2935' },
  ],

  /* ---------- scoring model + rules + financial assumptions ---------- */
  scoring_models: [
    { id: 'sm-v1', version_name: 'ROI Model v1.0', description: 'Baseline yield/scrap/downtime/detection model for the Sigenic Care calculator.', status: 'active', effective_from: '2026-01-01', created_by: 'u-priya' },
    { id: 'sm-v2', version_name: 'ROI Model v2.0 (draft)', description: 'Draft revision with higher EUV detection weighting. Not yet active.', status: 'draft', effective_from: '2026-07-01', created_by: 'u-priya' },
  ],

  // Rules: global baselines per metric + a few department/machine overrides.
  // min_value / max_value are improvement percentages; weight scales contribution.
  scoring_rules: [
    // global baselines (no department/process/machine = applies everywhere)
    { id: 'sr-g-yield', scoring_model_id: 'sm-v1', metric_type: 'yield_improvement', min_value: 1.5, max_value: 4.0, weight: 1.0, default_value: 2.5, notes: 'Global yield improvement baseline.' },
    { id: 'sr-g-scrap', scoring_model_id: 'sm-v1', metric_type: 'scrap_reduction', min_value: 8, max_value: 22, weight: 1.0, default_value: 15, notes: 'Global scrap reduction baseline.' },
    { id: 'sr-g-down', scoring_model_id: 'sm-v1', metric_type: 'downtime_reduction', min_value: 5, max_value: 18, weight: 1.0, default_value: 11, notes: 'Global unplanned downtime reduction baseline.' },
    { id: 'sr-g-detect', scoring_model_id: 'sm-v1', metric_type: 'detection_speed_improvement', min_value: 20, max_value: 60, weight: 1.0, default_value: 40, notes: 'Global excursion detection speed-up baseline.' },
    // lithography / EUV overrides — higher yield + detection headroom
    { id: 'sr-litho-yield', scoring_model_id: 'sm-v1', department_id: 'dep-litho', metric_type: 'yield_improvement', min_value: 3.0, max_value: 6.5, weight: 1.2, default_value: 4.5, notes: 'EUV/DUV overlay control yields larger uplift.' },
    { id: 'sr-euv-detect', scoring_model_id: 'sm-v1', department_id: 'dep-litho', machine_id: 'mac-euv-3600', metric_type: 'detection_speed_improvement', min_value: 40, max_value: 75, weight: 1.3, default_value: 58, notes: 'EUV excursion detection accelerated most.' },
    // etch overrides — strong scrap reduction
    { id: 'sr-etch-scrap', scoring_model_id: 'sm-v1', department_id: 'dep-etch', metric_type: 'scrap_reduction', min_value: 12, max_value: 28, weight: 1.15, default_value: 20, notes: 'Plasma etch variability reduction.' },
    // metrology overrides — detection + downtime
    { id: 'sr-metro-down', scoring_model_id: 'sm-v1', department_id: 'dep-metro', metric_type: 'downtime_reduction', min_value: 8, max_value: 24, weight: 1.1, default_value: 16, notes: 'Faster root-cause on inspection tools.' },
  ],

  financial_assumptions: [
    { id: 'fa-global', scoring_model_id: 'sm-v1', cost_per_wafer_default: 550, excursion_cost_default: 450000, monthly_volume_default: 8000, labor_cost_default: 65, currency: 'USD' },
    { id: 'fa-novacell', scoring_model_id: 'sm-v1', company_id: 'co-novacell', cost_per_wafer_default: 610, excursion_cost_default: 520000, monthly_volume_default: 12000, labor_cost_default: 70, currency: 'USD' },
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
    { id: 'kb-calc-logic', slug: 'calculator-assumptions', source_type: 'portal', title: 'SOP: ROI calculator logic & assumptions', summary: 'How the savings calculator estimates yield, scrap and downtime ranges.', category: 'Best Practices', tags_json: ['calculator', 'roi'], body: 'The calculator combines the active scoring model rules with your financial assumptions to produce min/max ranges...', featured: true, audience_type: 'all', last_reviewed_at: iso('2026-04-01') },
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

  /* ---------- service requests ---------- */
  service_requests: [
    { id: 'sr-001', company_id: 'co-novacell', site_id: 'site-novacell-sg', user_id: 'u-wei', request_type: 'support', title: 'EUV calibration drift after firmware update', description: 'Seeing overlay drift after updating to 2.4.1 on NXE:3600D.', department_id: 'dep-litho', process_id: 'proc-euv', machine_id: 'mac-euv-3600', urgency: 'high', status: 'open', source: 'portal_form', owner_team: 'support', contact_name: 'Wei Tan', contact_email: 'wei@novacell.sg', messages: [{ id: 'm1', author: 'Wei Tan', authorRole: 'you', body: 'Overlay drift started after the 2.4.1 update.', createdAt: iso('2026-05-21') }, { id: 'm2', author: 'Sigenic Support', authorRole: 'agent', body: 'Thanks Wei — please pin firmware to 2.4.0 and recalibrate. Tracking as ticket #4101.', createdAt: iso('2026-05-21') }] },
    { id: 'sr-002', company_id: 'co-quantex', site_id: 'site-quantex-tw', user_id: 'u-daniel', request_type: 'consultation', title: 'Scope a pilot on the etch line', description: 'Would like to discuss a 30-day pilot for plasma etch excursion detection.', department_id: 'dep-etch', urgency: 'medium', status: 'open', source: 'calculator_cta', owner_team: 'sales', contact_name: 'Daniel Ong', contact_email: 'daniel@quantex.com' },
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
      scoring_model_id: 'sm-v1', department_id: 'dep-litho', process_id: 'proc-euv', machine_id: 'mac-euv-3600',
      current_yield_pct: 82, defect_rate: 0.6, throughput: 95, scrap_rate: 3.2, downtime: 8,
      cost_per_wafer: 610, monthly_volume: 12000, excursion_cost: 520000,
      estimated_yield_improvement_min: 3.0, estimated_yield_improvement_max: 6.5,
      estimated_monthly_savings_min: 210000, estimated_monthly_savings_max: 430000,
      estimated_annual_savings_min: 2520000, estimated_annual_savings_max: 5160000,
      output_summary_json: { score: 84 },
    },
  ],

  /* ---------- audit log ---------- */
  audit_logs: [
    { id: 'al-1', user_id: 'u-priya', actor_name: 'Priya Nair', entity_type: 'scoring_model', entity_id: 'sm-v1', action: 'activate', new_value_json: { status: 'active' } },
    { id: 'al-2', user_id: 'u-priya', actor_name: 'Priya Nair', entity_type: 'company', entity_id: 'co-quantex', action: 'create', new_value_json: { company_name: 'Quantex Semiconductors' } },
    { id: 'al-3', user_id: 'u-bernard', actor_name: 'Bernard Soh', entity_type: 'machine', entity_id: 'mac-euv-3600', action: 'create', new_value_json: { machine_name: 'EUV Scanner NXE-3600' } },
  ],
}
