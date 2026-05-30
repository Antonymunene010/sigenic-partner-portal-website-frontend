# Sigenic Partner Portal

A full-stack partner portal built to the **Sigenic Partner Website 2026 PRD** (see `project_requirement/`).
It is a multi-actor platform serving four audiences — **Public**, **Distributor**, **Customer** and
**Internal Sigenic** — with company-level data isolation and a role-based permission matrix.

- **Public site** (no login): landing page, success stories, demo/contact requests, a limited ROI calculator.
- **Partner portal** (distributor & customer): dashboard, knowledge base, full ROI calculator, service
  requests, request tracking, company profile, team management, billing.
- **Internal admin** (built into the SPA): partner/company management, internal users, machine/process
  master data, **configurable scoring engine**, request oversight, knowledge & case-study management,
  announcements, audit log, and analytics.
- **Zendesk** keeps ticket execution; the portal is the intake + oversight layer.

Stack: **React + Vite + TailwindCSS** frontend, **Node (`http`) + PostgreSQL** backend, with Zendesk,
email (nodemailer) and PDF (pdfkit) integrations. Single codebase, one-command Docker run.

---

## Quick start (Docker — one command)

```bash
docker compose up --build
```

| Service  | URL                     | Purpose                          |
|----------|-------------------------|----------------------------------|
| app      | http://localhost:8787   | Portal (serves the SPA + API)    |
| mailpit  | http://localhost:8025   | Captures every outbound email    |
| postgres | localhost:5432          | Database (auto-migrated + seeded)|

The schema is created and demo data is seeded automatically on first boot. (Upgrading from the old
2-role build? The server detects the legacy schema and drops it so the new PRD schema seeds cleanly —
or run `npm run docker:down` to wipe the volume.)

### Demo accounts — password `demo`

| Role | Email | Org |
|------|-------|-----|
| Super Admin | `founder@sigenic.com` | Sigenic (internal) |
| Admin | `admin@sigenic.com` | Sigenic (internal) |
| Support Engineer | `support@sigenic.com` | Sigenic (internal) |
| Distributor Admin | `admin@apacpartners.com` | APAC Semiconductor Partners |
| Distributor User | `leo@apacpartners.com` | APAC Semiconductor Partners |
| Customer Admin | `karen@novacell.sg` | NovaCell Systems |
| Customer User | `wei@novacell.sg` | NovaCell Systems |
| Customer Admin | `daniel@quantex.com` | Quantex Semiconductors |

Sign in with different roles to see the permission matrix and company-level isolation in action.

## Local development (without Docker)

```bash
cp .env.example .env
npm install
npm run db:up          # postgres only (docker)
npm run backend        # API on :8787
npm run dev            # Vite dev server on :5173 (proxies /api → :8787)
```

Production-style run (build once, served by the API):

```bash
npm run build && npm start
```

---

## Data model (PRD §1)

Relational PostgreSQL schema in `server/schema.js`:

```
companies (sigenic | distributor | customer, parent_company_id → companies)
 ├─ sites
 ├─ users (user_type × role; 8 roles)
 ├─ service_requests ── (optional) → calculator_runs, zendesk_ticket_id
 ├─ calculator_runs
 └─ invoices
departments → processes → machines              (master data)
scoring_models → scoring_rules + financial_assumptions   (configurable ROI engine)
knowledge_articles · success_stories · announcements (audience-targeted) · audit_logs · notifications
```

## Roles & permission matrix (PRD §5)

Organisation type (business context) is separated from role (permissions). The matrix lives in
`server/permissions.js` (authoritative) and is mirrored in `src/lib/permissions.ts` for UX gating.

| | Public | Distrib. User | Distrib. Admin | Cust. User | Cust. Admin | Support | Admin | Super |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Full calculator | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save result | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Requests (own company) | ✗ | ✓ | ✓ | ✓ | ✓ | all | all | all |
| Manage own-company users | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Manage companies / scoring / master data | ✗ | ✗ | ✗ | ✗ | ✗ | view | ✓ | ✓ |
| Announcements / audit log | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

MVP rules enforced: no multi-customer distributor switching; external users cannot manage scoring;
ticket execution stays in Zendesk; company-level visibility by default.

## ROI scoring engine (configurable)

The calculator is **driven by admin-managed data**, not hard-coded numbers:
a `scoring_model` + its `scoring_rules` (per `metric_type`: yield / scrap / downtime / detection, with
min/max/weight, scoped to department/process/machine) + the resolved `financial_assumptions`
(cost-per-wafer, excursion cost, monthly volume) produce **min/max ranges** for yield improvement and
monthly/annual savings, persisted to `calculator_runs`. Logic lives in `server/calc.js`, mirrored in
`src/lib/calculator.ts`. Admins configure models, activate versions, and edit rules under
**Admin → Scoring**.

## Service requests & Zendesk

Structured intake for `support | demo | onboarding | consultation | feature_request`, auto-routed by
`owner_team` (support→Zendesk, demo/consultation→sales, onboarding→ops, feature_request→product).
Support requests create a Zendesk ticket and sync status + agent comments back (retry/backoff;
degrades to mock without credentials). Internal staff get an oversight view; ticket execution stays in
Zendesk.

## Email & audit

- Email on request creation, replies and announcement broadcasts (SMTP via `SMTP_HOST`, else a
  store-backed outbox at `GET /api/emails`).
- Every admin mutation (scoring, companies, users, content, status changes) writes an `audit_log`
  entry, surfaced under **Admin → Audit log**.

## Key API surface

```
# public
GET  /api/health
GET  /api/public                      # marketing bundle
POST /api/public/requests             # lead / demo / contact
POST /api/public/calculate            # limited public ROI
POST /api/auth/login

# authenticated
GET  /api/hydrate                     # role-scoped, company-isolated snapshot
POST /api/calculate                   # full ROI (+ save → calculator_runs)
POST /api/service-requests            # create (+ Zendesk route + email)
POST /api/service-requests/:id/messages
PATCH/POST /api/service-requests/...  # status / Zendesk sync
POST /api/users  · PATCH /api/users/:id  · POST /api/users/:id/reset-password
POST /api/scoring-models/:id/activate
POST /api/announcements               # publish + notify + email
GET  /api/analytics                   # internal KPIs
# generic admin CRUD (RBAC + audit):
GET|POST|PATCH|DELETE /api/{companies|sites|departments|processes|machines
  |scoring-models|scoring-rules|financial-assumptions|knowledge-articles|success-stories|invoices}
```

## Project structure

```
server/         Node http API — schema.js, store.js, permissions.js, calc.js, seed.js, index.js,
                zendesk.js, email.js, pdf.js, auth.js
src/lib/        types, api client, auth + data providers, permissions, calculator mirror, constants
src/components/ design system primitives (Card, StatCard, DataTable, CrudResource, Modal, Badge…) + layouts
src/pages/      public site, portal, and src/pages/admin/* (internal admin suite)
```

## Environment

See `.env.example`. Required in production: `AUTH_SECRET`. Optional: `SMTP_*` (email), `ZENDESK_*`
(real ticketing). `SEED_DEFAULT_PASSWORD` sets the demo accounts' password (default `demo`).
