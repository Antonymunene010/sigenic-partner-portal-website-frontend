# Sigenic Partner Portal

A full-stack partner portal built to the **Sigenic Partner Website 2026 PRD** (see `project_requirement/`).
Multi-actor platform with company-level data isolation and a role-based permission matrix.

- **Public site** (no login): success stories, demo / contact requests.
- **Partner portal** (distributor & customer): dashboard, knowledge base, risk & yield-loss calculator,
  service requests, request tracking, company profile, team management, billing.
- **Internal admin** (built into the same SPA): partner & company management, internal users, machine
  master data, **configurable scoring engine**, request oversight, knowledge & case-study management,
  announcements, audit log, analytics.

**Stack:** React + Vite + TailwindCSS · Express 5 + PostgreSQL · TypeScript end-to-end · single codebase,
one-command Docker run. Optional integrations: Zendesk (tickets), SMTP (email), Notion (knowledge base).

---

## Quick start (Docker — one command)

```bash
cp .env.example .env
docker compose up --build
```

| Service  | URL                     | Purpose                                |
|----------|-------------------------|----------------------------------------|
| app      | http://localhost:8787   | Portal (serves the SPA + API)          |
| mailpit  | http://localhost:8025   | Captures every outbound email locally  |
| postgres | localhost:5432          | Database (auto-created + seeded)       |

Schema and demo data are seeded on first boot of an empty database. To wipe and re-seed, run
`npm run docker:down` (drops the Postgres volume), then bring the stack up again.

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

Override the seed password with `SEED_DEFAULT_PASSWORD` in `.env` before first boot.

## Local development (without Docker)

```bash
cp .env.example .env
npm install
npm run db:up          # postgres only (docker)
npm run backend        # API on :8787 (tsx watch)
npm run dev            # Vite dev server on :5173 (proxies /api → :8787)
```

Production-style run (build once, served by the API):

```bash
npm run build && npm start
```

Other scripts: `npm run typecheck` (full TS build, no emit), `npm test` (`node:test` via tsx).

---

## Configuring external services

Every external service is **opt-in** and degrades gracefully when its env vars are blank:

- **No `AUTH_SECRET`** → boot fails (required).
- **No `SMTP_HOST`** → emails are recorded to a store-backed outbox; admins can read them at `GET /api/emails`.
- **No `ZENDESK_*`** → tickets work locally but are not pushed to Zendesk.
- **No `NOTION_*`** → KB serves only portal-authored articles.

All variables below live in `.env` (see `.env.example` for the full list with comments).

### 1. Database (`DATABASE_URL`) — required

```bash
DATABASE_URL=postgres://user:pass@host:5432/partner_portal
DATABASE_SSL=true   # set to true for managed Postgres (Neon, RDS, Supabase, etc.)
```

Schema is created automatically on boot via `CREATE TABLE IF NOT EXISTS`. **There is no migration
framework** — to apply schema changes to an existing database, drop and recreate the `public` schema
(data loss), or run `ALTER TABLE` statements by hand.

### 2. Auth (`AUTH_SECRET`) — required

```bash
AUTH_SECRET=$(openssl rand -hex 32)
AUTH_TTL_SECONDS=43200   # session lifetime (default 12h)
```

HMAC secret used to sign session tokens. Rotating it logs everyone out.

### 3. Email — SMTP (Gmail / Workspace / any provider)

Leave `SMTP_HOST` blank to keep **outbox-only** mode (every send is logged at `GET /api/emails` but
not delivered — useful for dev). The bundled `docker compose up` wires SMTP to a local **mailpit**
sink at <http://localhost:8025> so you can see real emails during development.

For real delivery, set `SMTP_*`. Gmail / Google Workspace example:

1. Sign in to the sending Google account → **Manage your Google Account → Security**. Make sure
   **2-Step Verification** is on (required for app passwords).
2. Still under **Security**, open **App passwords** (or visit <https://myaccount.google.com/apppasswords>
   directly). Enter an app name (e.g. `Sigenic Portal`) → **Create** → copy the 16-character password.
3. Set in `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=sales@sigenic.com
   SMTP_PASS=xxxxxxxxxxxxxxxx     # 16-char app password (spaces are stripped automatically)
   EMAIL_FROM=Sigenic Partner Portal <sales@sigenic.com>
   APP_BASE_URL=https://partner.sigenic.com   # used in invite / reset-password links
   ```
4. Test the handshake from the deploy host **before** wiring it in. There's a one-off script in the
   repo for this:
   ```bash
   SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
   SMTP_USER=sales@sigenic.com SMTP_PASS='xxxx xxxx xxxx xxxx' \
   node scripts/smtp-check.mjs --to you@example.com
   ```
   If `verify` succeeds locally but fails on the deploy host, the host is blocking outbound 465/587
   (common on Render / Vercel / some shared hosts). Switch to a host that allows outbound SMTP, use
   a relay, or fall back to outbox-only mode.

Any SMTP-compatible provider works the same way — point `SMTP_*` at the provider's host/port and use
the credentials they give you (SendGrid, Postmark, Amazon SES, etc.).

### 4. Zendesk (optional — two-way ticket sync)

When configured, support requests create a Zendesk ticket and sync status + agent comments back into
the portal every 60s. Created tickets are tagged `partner_portal` and carry `external_id` = the
portal's request id for easy correlation.

1. **Turn on API token access** (off by default).
   - In Zendesk **Admin Center → Apps and integrations** (left sidebar) → **APIs → Zendesk API**.
   - Open the **Settings** tab → toggle **Token access** on → **Save**.
2. **Create the token.**
   - Still on **APIs → Zendesk API**, open the **API tokens** tab → **Add API token**.
   - Add a description (e.g. `Partner Portal`) → **Save**. Copy the token immediately — Zendesk only
     shows it once.
3. Set in `.env` (all three required; missing any one disables the integration):
   ```bash
   ZENDESK_SUBDOMAIN=sigenic          # the part before .zendesk.com
   ZENDESK_EMAIL=ops@sigenic.com      # the agent account used for the API token
   ZENDESK_API_TOKEN=xxxxxxxxxxxxxxxx
   ZENDESK_SYNC_INTERVAL_MS=60000     # how often to pull ticket updates (default 60s)
   ZENDESK_TIMEOUT_MS=10000           # per-request timeout (default 10s)
   ```
4. (Optional) If you want the portal's `hold` status to round-trip, enable Zendesk's **On-hold**
   status: **Admin Center → Objects and rules → Tickets → Settings**, tick **Activate the On-hold
   status** → **Save**.

### 5. Notion (optional — Notion as KB source)

When configured, the portal pulls knowledge-base articles from a Notion database every 5 minutes
(read-only). Portal still owns featured / category / audience metadata per PRD §8.

1. **Create the integration and get its token.**
   - Open <https://www.notion.so/profile/integrations> (or in Notion: **Settings → Connections →
     Develop or manage integrations**).
   - **+ New integration** → name it (e.g. `Sigenic Partner Portal`), pick the workspace, set type
     **Internal** → **Save**.
   - Open the new integration → **Configuration** tab → copy the **Internal Integration Secret**
     (starts with `ntn_` or `secret_`).
2. **Set up the KB database.** Create a Notion database (or reuse one) with these columns
   (case-insensitive; all optional except the title):

   | Column | Type | Notes |
   |---|---|---|
   | Title | Title | Required (any column name works as long as type=Title) |
   | Summary | Text | One-line description |
   | Slug | Text | URL slug; auto-generated from title if blank |
   | Category | Select | e.g. Best Practices, Troubleshooting, FAQs |
   | Tags | Multi-select | |
   | Audience | Select | `All` / `Customers` / `Distributors` / `Internal` |
   | Featured | Checkbox | |
   | Status | Select | `Published` / `Live` / `Approved` → surfaced; anything else → hidden |

3. **Share the database with the integration.**
   - Open the database as a full page → click the **`...`** menu (top-right) → **Connections** →
     **+ Add connections** → search and select your integration → **Confirm**.
4. **Get the database id.** Copy the database URL — the id is the 32-char hex segment between the
   last `/` and the `?`:
   ```
   https://www.notion.so/<workspace>/<DATABASE_ID>?v=...
   ```
5. Set in `.env`:
   ```bash
   NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxx
   NOTION_KB_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   NOTION_SYNC_INTERVAL_MS=300000     # default 5 min
   NOTION_VERSION=2022-06-28          # Notion API version
   ```

Notion-hosted images use short-lived signed URLs (~1h), so the portal stores a stable proxy path
(`/api/notion/image/:blockId`) and resolves the live URL on demand — no need to re-export images.

### 6. CORS (optional — only when SPA and API are on different origins)

```bash
CORS_ORIGIN=https://portal.example.com   # default: *
```

---

## Production deployment

Two supported paths. Pick by infrastructure preference — the app itself is identical either way.

### Option A — Single VPS with Docker (recommended)

Best when you control a Linux box and want everything (app + database) in one place. Postgres runs
in a container; you only need a host-level reverse proxy (Caddy / nginx) to terminate TLS.

**Prerequisites:** Linux VPS with Docker + Compose v2, a domain pointing at it, an A record for
the portal subdomain (e.g. `partner.sigenic.com`).

1. **Clone the repo on the server.**
   ```bash
   git clone https://github.com/jingwangl/partner-dashboard.git
   cd partner-dashboard
   ```
2. **Create `.env` with strong secrets.** `docker-compose.prod.yml` uses `${VAR:?...}` so missing
   secrets fail loudly at boot.
   ```bash
   cp .env.example .env
   ```
   Then in `.env`:
   ```bash
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   AUTH_SECRET=$(openssl rand -hex 32)
   SEED_DEFAULT_PASSWORD=$(openssl rand -hex 12)   # one-off; rotate the seeded accounts after first login
   APP_BASE_URL=https://partner.sigenic.com         # used in invite / reset-password emails

   # Email — required for invites, password resets, ticket notifications
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=sales@sigenic.com
   SMTP_PASS=xxxxxxxxxxxxxxxx
   EMAIL_FROM=Sigenic Partner Portal <sales@sigenic.com>

   # Optional integrations — leave blank to disable
   # ZENDESK_SUBDOMAIN=...
   # ZENDESK_EMAIL=...
   # ZENDESK_API_TOKEN=...
   # NOTION_TOKEN=...
   # NOTION_KB_DATABASE_ID=...
   ```
3. **Boot the stack.**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   First boot creates the schema and seeds demo data. `docker compose -f docker-compose.prod.yml logs -f app`
   to follow startup; you should see `Sigenic Partner Portal API listening on http://localhost:8787`.
4. **Front it with a reverse proxy.** The app binds to `127.0.0.1:8787` only — the proxy is the
   sole public entry point.
   - **Caddy (recommended; auto-TLS):** create `/etc/caddy/Caddyfile`:
     ```
     partner.sigenic.com {
       reverse_proxy 127.0.0.1:8787
     }
     ```
     then `sudo systemctl reload caddy`.
   - **nginx:** proxy `partner.sigenic.com:443` → `127.0.0.1:8787`, terminate TLS with certbot.
5. **Verify.** `curl https://partner.sigenic.com/api/health` should return JSON. Sign in with one of
   the seeded demo accounts (password = your `SEED_DEFAULT_PASSWORD`), then immediately rotate the
   seeded passwords and create real internal users (**Admin → Internal users**).

**Redeploying after a code change:**
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
Postgres volume (`postgres_data`) persists across rebuilds. **Do not** add `-v` to `down` unless you
want to wipe the database.

**Backups.** The compose file does not bundle backups — schedule `pg_dump` against the postgres
container (or the managed DB) on whatever cadence fits.

### Option B — Shared hosting (Hostinger) + managed Postgres (Neon)

Best when you don't want to run a VPS. The app ships as a zip upload; Postgres is hosted (Neon,
Supabase, RDS, etc.). This is the path currently used in production.

**Prerequisites:** A managed Postgres database, a Hostinger Web App slot with **Node.js 20+** and
**Express** preset, the portal subdomain pointed at Hostinger.

1. **Provision Postgres** (Neon example).
   - <https://console.neon.tech> → **Create project** → copy the connection string.
   - Make sure it ends with `?sslmode=require`.
2. **Build the zip locally.** Hostinger's deploy pipeline does **not** copy build artifacts, and the
   runtime strips execute bits so on-the-fly compilers (tsx/esbuild) cannot spawn — the script bakes
   the pre-built SPA and the esbuild-bundled server into the zip:
   ```bash
   bash scripts/package-hostinger.sh portal.zip
   ```
   Script reads from `HEAD`, so commit (or stash) any pending changes first.
3. **Create the Hostinger app.**
   - hPanel → **Websites → Web Apps → Create new** → preset **Express**, Node **20+**, entry file
     **`server.js`**, app domain = `partner.sigenic.com` (or your subdomain).
   - `server.js` is a deliberate shim: LiteSpeed loads it with `require()` (forbids top-level
     await), strips execute bits (blocks tsx/esbuild spawning), and doesn't inject `PORT`. The
     shim works around all three by preferring the precompiled `dist-server/index.js` and
     defaulting `PORT` to 3000 — don't simplify it without re-testing on Hostinger.
4. **Configure env vars.** Open the new web app → **Environment variables** → add:
   ```
   DATABASE_URL=postgres://user:pass@host.neon.tech/partner_portal?sslmode=require
   DATABASE_SSL=true
   PORT=3000                        # Hostinger's LiteSpeed proxies to :3000
   AUTH_SECRET=<openssl rand -hex 32>
   SEED_DEFAULT_PASSWORD=<one-off random>
   APP_BASE_URL=https://partner.sigenic.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=sales@sigenic.com
   SMTP_PASS=<gmail app password>
   EMAIL_FROM=Sigenic Partner Portal <sales@sigenic.com>
   ```
   Add `ZENDESK_*` / `NOTION_*` only if those integrations are enabled.
5. **Upload the zip.** Web app → **Deployments → Upload new files** → pick `portal.zip` → deploy.
   (Don't click "Use previous files" — that re-uses the last upload without your latest changes.)
6. **Verify.** `https://partner.sigenic.com/api/health` should return JSON. If it doesn't, the
   real error is in **File Manager → `domains/<your-domain>/nodejs/stderr.log`** — Hostinger's
   Runtime Logs panel often shows nothing for boot-time crashes.

**Redeploying after a code change:** rebuild zip locally with `package-hostinger.sh`, upload again
via Deployments → Upload new files. Hostinger does not have a Git auto-deploy hook.

**Backups.** Use the managed DB provider's snapshot feature (Neon's Point-in-Time Restore is on by
default on paid tiers).

### Updating the database schema in production

**There is no migration framework.** `store.init()` runs `CREATE TABLE IF NOT EXISTS …` only — it
will not modify columns or constraints on existing tables, and the seed step only runs when
`companies` is empty. So changes to `server/db/schema.ts` after first boot do **not** auto-apply.

Two options when you need to ship a schema change:

- **Data is disposable (typical for staging or pre-launch).** Wipe and re-seed:
  1. Confirm the new code is already deployed.
  2. In the DB console: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` (and re-grant if needed).
  3. Restart the app — `store.init()` re-creates the schema and re-seeds demo data.
  4. **Order matters:** wipe **first**, restart **after**. If `companies` is non-empty at boot, the
     seed step skips and old constraints persist.
- **Data must be preserved.** Write the `ALTER TABLE` / `INSERT` statements by hand and run them in
  the DB console against production before deploying the code that depends on them.

If Hostinger and the VPS share the same Postgres (Neon), wiping the schema affects **both** at once.

---

## Operational notes

A few behaviours that aren't obvious from reading the code, surfaced here so they don't have to be
rediscovered:

- **`AUTH_SECRET` placeholders only warn.** The known weak values
  (`change-me-in-production`, `dev-insecure-secret-change-me`) trigger a `console.warn` but do
  not block boot. Production deployments must set a real value.
- **The outbox table grows unbounded.** Every email send (delivered or not) is persisted in
  `emails`. A periodic `DELETE FROM emails WHERE created_at < now() - interval '90 days'` keeps
  it bounded if needed.
- **Calculator submissions fan out to every active internal admin** (`super_admin` + `admin`) via
  `notifyInternalAdmins` in `server/infra/email.ts`. To exclude a user from the page-out, set their
  role to `support_engineer` (still has oversight, no email).
- **Zendesk sync runs once per `ZENDESK_SYNC_INTERVAL_MS`** (default 60s). Status changes made
  directly in Zendesk surface in the portal within a cycle, not instantly. The loop never overlaps —
  the next tick is armed only after the current one settles.
- **Notion images flow through the portal.** Article bodies store
  `/api/notion/image/:blockId`; the proxy resolves a fresh signed Notion URL on demand and caches
  it until just before expiry. Removing the Notion integration without re-authoring those articles
  would 404 the images.
- **Self-service sign-up needs an approver.** New-company requests notify internal admins;
  existing-company requests notify that company's own admins (`distributor_admin` /
  `customer_admin`). Pending requests sit in **Admin → Sign-ups** until reviewed.
- **The Login page exposes the demo-account list.** `src/pages/Login.tsx` defines a
  `DEMO_ACCOUNTS` array and renders a one-click picker that fills in the seeded emails + password
  `demo`. Useful in dev / demo environments; for an external-facing production build, delete the
  constant and the block that maps it, or gate them behind an env flag.
- **Seed runs once, on an empty `companies` table.** Re-deploying does not re-seed. To restore the
  demo dataset, drop the schema first (see above).
- **PRD lives in `project_requirement/`** (gitignored — distributed separately). §5.1 is the
  authoritative permission matrix; §8 covers KB / Notion governance.

---

## Architecture

```
server/         Express 5 API (TypeScript via tsx)
  api/          Routers + middleware (auth, CORS, error)
  services/     Business logic (re-authorised per mutation)
  db/           Schema, store, pool, seed
  infra/        auth, email, pdf
  integration/  zendesk, notion (graceful degrade when unconfigured)
shared/         Single source of truth for permissions, types, calc — imported by both server & SPA
src/            React + Vite SPA
  pages/        Public site, portal, src/pages/admin/* (internal admin suite)
  components/   Design system primitives + layouts
  lib/          API client, auth + data providers, formatters
tests/          node:test via tsx — covers shared/calc, shared/permissions, db/columns, services/
```

**Authoritative permission matrix:** `shared/permissions.ts`. The frontend uses it for UX gating; the
backend re-authorises every mutation in the service layer.

**Authoritative scoring logic:** `shared/calc.ts`. Risk score = severity score + occurrence score +
detection score (banded High 9–15 / Medium 4–8 / Low 1–3). Annual yield loss = Σ(severity × occurrence)
× wafer price. Admins configure the issue catalog and lookup tables under **Admin → Calculator config**.

## Key API surface

```
# public (no auth)
GET  /api/health
GET  /api/public                      # marketing bundle (stories, public KB, request taxonomies)
POST /api/public/requests             # lead / demo / contact form
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/signup                      # self-service sign-up (admin-approved)

# authenticated
GET  /api/hydrate                     # role-scoped, company-isolated snapshot
POST /api/calculate                   # risk & yield-loss run (+ optional save → calculator_runs)
POST /api/service-requests            # create (+ Zendesk route + email)
POST /api/service-requests/:id/messages
POST /api/users                       # invite
POST /api/users/:id/reset-password
POST /api/scoring-models/:id/activate
POST /api/announcements               # publish + notify + email
GET  /api/analytics                   # internal KPIs
GET  /api/emails                      # outbox (super_admin/admin)
GET  /api/notion/image/:blockId       # proxy that resolves a Notion file URL on demand

# generic admin CRUD (RBAC + audit)
GET|POST|PATCH|DELETE /api/{companies|sites|departments|machines
  |scoring-models|calculator-issues|occurrence-options|detection-options|technology-prices
  |request-types|request-departments|request-processes|request-machines
  |knowledge-articles|success-stories|invoices}
```

## Environment variable reference

`.env.example` is the canonical list — every variable is documented inline with its default and
when to set it. The per-integration sections above cover the values that need explanation.
