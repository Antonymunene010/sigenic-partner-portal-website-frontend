# Sigenic Partner Portal

Full-stack React + Node partner portal for support requests, service intake, content, billing views, calculator rules, and admin workflows.

## Run locally

```bash
cp .env.example .env
npm run db:up
DATABASE_URL=postgres://postgres:postgres@localhost:5432/partner_portal npm run backend
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8787`. For a production-style run:

```bash
npm run build
DATABASE_URL=postgres://postgres:postgres@localhost:5432/partner_portal npm start
```

## Demo accounts

- Partner: `partner@demo.com`
- Admin: `admin@demo.com`
- Any non-empty password is accepted in demo mode.

## Backend

- API server: `server/index.js`
- PostgreSQL store: `server/store.js`
- Required database env: `DATABASE_URL`
- Optional managed-Postgres SSL: `DATABASE_SSL=true`
- Health check: `GET /api/health`
- Bootstrap: `POST /api/bootstrap`
- Resource persistence: `GET|PUT /api/resources/:key`
- Auth: `POST /api/auth/login`
- Ticket creation: `POST /api/tickets`
- Calculator: `POST /api/calculate`

## PostgreSQL schema

The server runs idempotent schema setup on boot:

- `users` stores partner/admin accounts.
- `tickets` stores support, service, demo, and calculator-generated tickets.
- `app_resources` stores configurable JSONB resources such as stories, docs, invoices, announcements, notifications, calculator config, and latest calculator result.

On the first empty database boot, `/api/bootstrap` seeds PostgreSQL from the frontend seed/local demo data.

## Zendesk

Set these environment variables before running `npm run backend` or `npm start`:

```bash
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=agent@example.com
ZENDESK_API_TOKEN=your-token
```

Without Zendesk credentials, ticket creation stays fully functional and records locally with `mode: "mock"`.
