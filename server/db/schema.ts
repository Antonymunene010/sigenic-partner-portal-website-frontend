/**
 * PRD-aligned relational schema for the Sigenic Partner Portal.
 *
 * Mirrors "Schema, UI Flow, and Permission Matrix" §1: companies, sites, users,
 * departments, processes, machines, scoring_models, calculator_issues, the
 * calculator Configuration tables (occurrence_options, detection_options,
 * technology_prices), calculator_runs, service_requests, knowledge_articles,
 * announcements, audit_logs — plus success_stories (public case studies),
 * invoices (billing visibility) and notifications (in-app, future-facing).
 *
 * All DDL is idempotent (CREATE TABLE IF NOT EXISTS). Enum-like columns use CHECK
 * constraints. IDs are application-generated text (prefix-hex) for portability.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY,
  company_name text NOT NULL,
  company_code text UNIQUE,
  company_type text NOT NULL CHECK (company_type IN ('sigenic','distributor','customer')),
  parent_company_id text REFERENCES companies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_invite'
    CHECK (status IN ('pending_invite','active','suspended','inactive','archived')),
  industry text,
  country text,
  website text,
  zendesk_org_id text,
  billing_contact_name text,
  billing_contact_email text,
  onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started','invited','accepted','profile_completed','live')),
  onboarding_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_tier text,
  subscription_type text,
  trial boolean NOT NULL DEFAULT false,
  contract_start date,
  renewal_date date,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Country/region + website added with the "Invite Company" flow (client feedback 2026-06).
-- (CREATE TABLE IF NOT EXISTS won't alter an existing table, so we add columns here.)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website text;

-- Company status lifecycle changed from active/inactive/prospect to the invite-aware
-- set (client feedback 2026-06). On an existing DB the CREATE TABLE above won't touch
-- the old CHECK/DEFAULT, so migrate in place. Idempotent: runs on every init.
-- Order matters: DROP the old CHECK first, THEN remap data to the new values (the
-- old constraint forbade 'pending_invite'), THEN add the new CHECK and default.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
UPDATE companies SET status = 'pending_invite'
  WHERE status NOT IN ('pending_invite','active','suspended','inactive','archived');
ALTER TABLE companies ADD CONSTRAINT companies_status_check
  CHECK (status IN ('pending_invite','active','suspended','inactive','archived'));
ALTER TABLE companies ALTER COLUMN status SET DEFAULT 'pending_invite';

-- Onboarding lifecycle reworked to the 5 client-facing states (client feedback
-- 2026-06): the old set was {not_started, invited, in_progress, fully_onboarded}
-- and the column was never actually written to at runtime. Auto-tracked now by
-- the recomputeOnboardingStatus helper at every relevant mutation point.
-- Order matters: DROP the old CHECK first, THEN remap legacy values, THEN add
-- the new CHECK. Idempotent: 'invited'/'not_started' map to themselves; the
-- new values are no-ops on a re-run.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_onboarding_status_check;
UPDATE companies SET onboarding_status = CASE onboarding_status
  WHEN 'in_progress' THEN 'accepted'
  WHEN 'fully_onboarded' THEN 'live'
  ELSE onboarding_status
END WHERE onboarding_status IN ('in_progress','fully_onboarded');
ALTER TABLE companies ADD CONSTRAINT companies_onboarding_status_check
  CHECK (onboarding_status IN ('not_started','invited','accepted','profile_completed','live'));

CREATE TABLE IF NOT EXISTS sites (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_name text NOT NULL,
  site_code text,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text,
  user_type text NOT NULL CHECK (user_type IN ('internal','distributor','customer')),
  role text NOT NULL CHECK (role IN (
    'super_admin','admin','support_engineer',
    'distributor_admin','distributor_user',
    'customer_admin','customer_user'
  )),
  avatar text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','invited','pending','rejected')),
  -- Who issued the invite / approved the sign-up — so we can email the inviter
  -- when their invitee accepts (client feedback 2026-06). ON DELETE SET NULL so
  -- removing the inviter doesn't cascade their invitees away.
  invited_by text REFERENCES users(id) ON DELETE SET NULL,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Additive column for portals already deployed on an older users schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by text REFERENCES users(id) ON DELETE SET NULL;

-- Self-service sign-up adds two user states (client feedback 2026-06): 'pending'
-- (registered, awaiting admin approval) and 'rejected' (approval declined, kept for
-- the record). CREATE TABLE IF NOT EXISTS won't widen an existing CHECK, so drop and
-- re-add it. Idempotent; no data remap needed — the old values stay valid.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active','inactive','invited','pending','rejected'));

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text,
  description text,
  technology text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processes (
  id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  process_name text NOT NULL,
  process_code text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS machines (
  id text PRIMARY KEY,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  process_id text REFERENCES processes(id) ON DELETE SET NULL,
  machine_name text NOT NULL,
  machine_code text,
  machine_category text,
  vendor text,
  model text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scoring_models (
  id text PRIMARY KEY,
  version_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  effective_from date,
  effective_to date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Risk-issue catalog: the questionnaire rows for a department/template within a
-- scoring model. The active model's issues drive the calculator.
CREATE TABLE IF NOT EXISTS calculator_issues (
  id text PRIMARY KEY,
  scoring_model_id text NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  department_id text NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  default_severity double precision,
  default_occurrence double precision,
  default_detection text CHECK (default_detection IN ('unable','partial','system')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Calculator "Configuration" lookups (admin-maintained, global).
CREATE TABLE IF NOT EXISTS occurrence_options (
  id text PRIMARY KEY,
  value double precision NOT NULL,
  score double precision NOT NULL,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detection_options (
  id text PRIMARY KEY,
  key text NOT NULL CHECK (key IN ('unable','partial','system')),
  label text NOT NULL,
  score double precision NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS technology_prices (
  id text PRIMARY KEY,
  technology text NOT NULL,
  label text,
  min_price double precision NOT NULL DEFAULT 0,
  avg_price double precision NOT NULL DEFAULT 0,
  max_price double precision NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Calculator submissions: persisted only when the user clicks "Submit and Send Email"
-- at the end of the 3-step wizard (Basic info → Statistical analysis → Additional info).
-- Intermediate calculations are stateless on /api/calculate.
CREATE TABLE IF NOT EXISTS calculator_runs (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  run_type text NOT NULL CHECK (run_type IN ('public','partner','distributor','internal')),
  scoring_model_id text REFERENCES scoring_models(id) ON DELETE SET NULL,
  department_id text REFERENCES departments(id) ON DELETE SET NULL,
  machine_id text REFERENCES machines(id) ON DELETE SET NULL,
  technology text,
  wafer_value double precision,
  price_source text,
  overall_risk_score double precision,
  overall_tier text,
  total_annual_wafer_loss double precision,
  total_annual_value_loss double precision,
  inputs_json jsonb,
  output_summary_json jsonb,
  client_name text,
  contact_name text,
  contact_email text,
  preventive_measures text,
  costs_incurred text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Additive columns for portals already deployed on an older calculator_runs schema.
-- (CREATE TABLE IF NOT EXISTS won't alter an existing table, so we add columns here.)
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS preventive_measures text;
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS costs_incurred text;
ALTER TABLE calculator_runs ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Configurable request-type taxonomy. Super-admins manage these (label, the
-- owner team a new request routes to, the blurb shown on the intake form). The
-- slug is the stable value stored in service_requests.request_type; rows are
-- soft-disabled via active rather than deleted, so historical requests keep
-- their type. No FK from service_requests so a (mis)removed slug never orphans
-- a request — the service layer validates against active rows on intake.
CREATE TABLE IF NOT EXISTS request_types (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  owner_team text NOT NULL DEFAULT 'support' CHECK (owner_team IN ('support','sales','ops','product')),
  blurb text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Request-form taxonomy — the department/process/machine selectors on the
-- service-request intake form. DELIBERATELY SEPARATE from the calculator's
-- departments/processes/machines master data (which carries scoring-specific
-- fields like the technology column and feeds calculator_issues): super-admins
-- configure these independently on the "Request config" screen, so adding or
-- retiring a request taxonomy row never touches the calculator and vice-versa.
-- Soft-disabled via the active flag. (Site uses the company's own sites table,
-- which is already calculator-independent, so there is no request_sites table.)
CREATE TABLE IF NOT EXISTS request_departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_processes (
  id text PRIMARY KEY,
  request_department_id text NOT NULL REFERENCES request_departments(id) ON DELETE CASCADE,
  process_name text NOT NULL,
  process_code text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_machines (
  id text PRIMARY KEY,
  request_department_id text NOT NULL REFERENCES request_departments(id) ON DELETE CASCADE,
  request_process_id text REFERENCES request_processes(id) ON DELETE SET NULL,
  machine_name text NOT NULL,
  machine_code text,
  machine_category text,
  vendor text,
  model text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  -- Validated against request_types (active rows) in the service layer, not a CHECK,
  -- so super-admins can add/retire types without a schema migration.
  request_type text NOT NULL,
  title text NOT NULL,
  description text,
  -- department/process/machine reference the request_* taxonomy (NOT the calculator
  -- master data) by convention. No FK — mirrors request_type above: retiring a
  -- taxonomy row never orphans a request, and the service layer validates on intake.
  department_id text,
  process_id text,
  machine_id text,
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','pending','hold','solved','closed')),
  source text NOT NULL DEFAULT 'portal_form'
    CHECK (source IN ('landing_page','portal_form','calculator_cta','dashboard')),
  owner_team text NOT NULL DEFAULT 'support' CHECK (owner_team IN ('support','sales','ops','product')),
  linked_calculator_run_id text REFERENCES calculator_runs(id) ON DELETE SET NULL,
  zendesk_ticket_id text,
  contact_name text,
  contact_email text,
  interest_type text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id text PRIMARY KEY,
  source_type text NOT NULL DEFAULT 'portal' CHECK (source_type IN ('zendesk','notion','portal')),
  source_ref_id text,
  slug text UNIQUE,
  title text NOT NULL,
  summary text,
  category text,
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  body text,
  cover_image_id text,
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','distributor','customer','internal')),
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Additive columns for portals already deployed on an older knowledge_articles schema.
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS cover_image_id text;

-- Binary uploads (images + files) embedded into knowledge/success-story bodies by
-- the rich-text editor. Served back via a stable /api/attachments/:id URL.
CREATE TABLE IF NOT EXISTS article_assets (
  id text PRIMARY KEY,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  data bytea NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS success_stories (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text,
  partner text,
  industry text,
  region text,
  theme text,
  metrics_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  body text,
  cover_image_id text,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  featured boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','partners','internal')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Additive column for portals already deployed on an older success_stories schema.
ALTER TABLE success_stories ADD COLUMN IF NOT EXISTS cover_image_id text;

CREATE TABLE IF NOT EXISTS announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','distributor','customer','internal')),
  company_id text REFERENCES companies(id) ON DELETE CASCADE,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expire_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  amount double precision NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('paid','open','overdue')),
  issued_at date,
  line_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  company_id text REFERENCES companies(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  user_id text,
  actor_name text,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  old_value_json jsonb,
  new_value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id text PRIMARY KEY,
  to_email text NOT NULL,
  subject text,
  body text,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Per-slug overrides for the outbound-email templates. The slug is the stable
-- identifier the server uses to look up a template at send-time (e.g. 'invite',
-- 'password_reset_link'); the row is the super-admin-edited subject + body
-- string with {{var}} placeholders. Code keeps a default for every slug, so a
-- missing row simply renders the default — there is no separate seed step,
-- and a "Reset to default" action is implemented as a DELETE.
CREATE TABLE IF NOT EXISTS email_templates (
  slug text PRIMARY KEY,
  subject text NOT NULL,
  body text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_processes_department ON processes(department_id);
CREATE INDEX IF NOT EXISTS idx_machines_department ON machines(department_id);
CREATE INDEX IF NOT EXISTS idx_request_processes_department ON request_processes(request_department_id);
CREATE INDEX IF NOT EXISTS idx_request_machines_department ON request_machines(request_department_id);
CREATE INDEX IF NOT EXISTS idx_calculator_issues_model ON calculator_issues(scoring_model_id);
CREATE INDEX IF NOT EXISTS idx_calculator_issues_department ON calculator_issues(department_id);
CREATE INDEX IF NOT EXISTS idx_calculator_runs_company ON calculator_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_calculator_runs_user ON calculator_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_company ON service_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_zendesk ON service_requests(zendesk_ticket_id);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience_type);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
`

/**
 * Legacy tables from the pre-PRD 2-role build (users with role CHECK partner|admin,
 * a flat tickets table, and the app_resources JSON blob store). If we detect that
 * shape and the new `companies` table is absent, drop them so the new schema seeds
 * cleanly. Demo/seed data only — safe to drop.
 */
export const LEGACY_CHECK_SQL = `
  SELECT
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') AS has_companies,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_resources') AS has_legacy_resources,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'company') AS has_legacy_users
`

export const LEGACY_DROP_SQL = `
  DROP TABLE IF EXISTS app_resources CASCADE;
  DROP TABLE IF EXISTS tickets CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
`
