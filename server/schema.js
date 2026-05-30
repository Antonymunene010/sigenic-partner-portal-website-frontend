/**
 * PRD-aligned relational schema for the Sigenic Partner Portal.
 *
 * Mirrors "Schema, UI Flow, and Permission Matrix" §1: companies, sites, users,
 * departments, processes, machines, scoring_models, scoring_rules,
 * financial_assumptions, calculator_runs, service_requests, knowledge_articles,
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
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
  industry text,
  zendesk_org_id text,
  billing_contact_name text,
  billing_contact_email text,
  onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started','invited','in_progress','fully_onboarded')),
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
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','invited')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text,
  description text,
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

CREATE TABLE IF NOT EXISTS scoring_rules (
  id text PRIMARY KEY,
  scoring_model_id text NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  department_id text REFERENCES departments(id) ON DELETE SET NULL,
  process_id text REFERENCES processes(id) ON DELETE SET NULL,
  machine_id text REFERENCES machines(id) ON DELETE SET NULL,
  metric_type text NOT NULL CHECK (metric_type IN (
    'yield_improvement','scrap_reduction','downtime_reduction','detection_speed_improvement'
  )),
  min_value double precision NOT NULL DEFAULT 0,
  max_value double precision NOT NULL DEFAULT 0,
  weight double precision NOT NULL DEFAULT 1,
  default_value double precision,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_assumptions (
  id text PRIMARY KEY,
  scoring_model_id text NOT NULL REFERENCES scoring_models(id) ON DELETE CASCADE,
  company_id text REFERENCES companies(id) ON DELETE CASCADE,
  site_id text REFERENCES sites(id) ON DELETE CASCADE,
  cost_per_wafer_default double precision NOT NULL DEFAULT 0,
  excursion_cost_default double precision NOT NULL DEFAULT 0,
  monthly_volume_default double precision NOT NULL DEFAULT 0,
  labor_cost_default double precision,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calculator_runs (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  run_type text NOT NULL CHECK (run_type IN ('public','partner','distributor','internal')),
  scoring_model_id text REFERENCES scoring_models(id) ON DELETE SET NULL,
  department_id text REFERENCES departments(id) ON DELETE SET NULL,
  process_id text REFERENCES processes(id) ON DELETE SET NULL,
  machine_id text REFERENCES machines(id) ON DELETE SET NULL,
  current_yield_pct double precision,
  defect_rate double precision,
  throughput double precision,
  scrap_rate double precision,
  downtime double precision,
  cost_per_wafer double precision,
  monthly_volume double precision,
  excursion_cost double precision,
  estimated_yield_improvement_min double precision,
  estimated_yield_improvement_max double precision,
  estimated_monthly_savings_min double precision,
  estimated_monthly_savings_max double precision,
  estimated_annual_savings_min double precision,
  estimated_annual_savings_max double precision,
  output_summary_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id text PRIMARY KEY,
  company_id text REFERENCES companies(id) ON DELETE SET NULL,
  site_id text REFERENCES sites(id) ON DELETE SET NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN (
    'support','demo','onboarding','consultation','feature_request'
  )),
  title text NOT NULL,
  description text,
  department_id text REFERENCES departments(id) ON DELETE SET NULL,
  process_id text REFERENCES processes(id) ON DELETE SET NULL,
  machine_id text REFERENCES machines(id) ON DELETE SET NULL,
  urgency text NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','submitted','in_review','routed','closed')),
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
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','distributor','customer','internal')),
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
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
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  featured boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','partners','internal')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_parent ON companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_processes_department ON processes(department_id);
CREATE INDEX IF NOT EXISTS idx_machines_department ON machines(department_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_model ON scoring_rules(scoring_model_id);
CREATE INDEX IF NOT EXISTS idx_financial_assumptions_model ON financial_assumptions(scoring_model_id);
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
