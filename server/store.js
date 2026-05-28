import { Pool } from 'pg'

export const allowedResources = new Set([
  'users',
  'tickets',
  'stories',
  'docs',
  'invoices',
  'calc',
  'calc.latest',
  'announcements',
  'notifications',
])

const jsonResourceKeys = ['stories', 'docs', 'invoices', 'calc', 'calc.latest', 'announcements', 'notifications']

function dbConfig() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Set it to your PostgreSQL connection string.')
  }
  return {
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  }
}

export function createStore() {
  const pool = new Pool(dbConfig())

  const query = (text, params) => pool.query(text, params)

  async function init() {
    await query(`
      CREATE TABLE IF NOT EXISTS app_resources (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        email text NOT NULL UNIQUE,
        name text NOT NULL,
        company text NOT NULL,
        role text NOT NULL CHECK (role IN ('partner', 'admin')),
        avatar text,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id text PRIMARY KEY,
        subject text NOT NULL,
        status text NOT NULL,
        priority text NOT NULL,
        category text NOT NULL,
        product_area text,
        customer_impact text,
        requester text NOT NULL,
        assignee text,
        tags text[] NOT NULL DEFAULT '{}',
        messages jsonb NOT NULL DEFAULT '[]'::jsonb,
        source text,
        zendesk_ticket_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
    `)
  }

  async function health() {
    const res = await query('select current_database() as database, current_schema() as schema')
    return res.rows[0]
  }

  async function isEmpty() {
    const res = await query(`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM tickets) AS tickets,
        (SELECT count(*)::int FROM app_resources) AS resources
    `)
    const row = res.rows[0]
    return row.users === 0 && row.tickets === 0 && row.resources === 0
  }

  async function getUsers() {
    const res = await query(`
      SELECT id, email, name, company, role, avatar, active, created_at AS "createdAt"
      FROM users
      ORDER BY created_at DESC, name ASC
    `)
    return res.rows.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt),
    }))
  }

  async function getUserByEmail(email) {
    const res = await query(
      `
        SELECT id, email, name, company, role, avatar, active, created_at AS "createdAt"
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
      `,
      [email],
    )
    const row = res.rows[0]
    return row ? { ...row, createdAt: toIso(row.createdAt) } : null
  }

  async function replaceUsers(users) {
    await transaction(async (client) => {
      await client.query('DELETE FROM users')
      for (const user of users ?? []) {
        await upsertUser(user, client)
      }
    })
    return getUsers()
  }

  async function upsertUser(user, client = { query }) {
    await client.query(
      `
        INSERT INTO users (id, email, name, company, role, avatar, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), now())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          company = EXCLUDED.company,
          role = EXCLUDED.role,
          avatar = EXCLUDED.avatar,
          active = EXCLUDED.active,
          created_at = EXCLUDED.created_at,
          updated_at = now()
      `,
      [
        user.id,
        user.email,
        user.name,
        user.company,
        user.role,
        user.avatar ?? null,
        user.active ?? true,
        user.createdAt ?? null,
      ],
    )
  }

  async function getTickets() {
    const res = await query(`
      SELECT
        id,
        subject,
        status,
        priority,
        category,
        product_area AS "productArea",
        customer_impact AS "customerImpact",
        requester,
        assignee,
        tags,
        messages,
        source,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM tickets
      ORDER BY updated_at DESC, created_at DESC
    `)
    return res.rows.map(rowToTicket)
  }

  async function replaceTickets(tickets) {
    await transaction(async (client) => {
      await client.query('DELETE FROM tickets')
      for (const ticket of tickets ?? []) {
        await upsertTicket(ticket, null, client)
      }
    })
    return getTickets()
  }

  async function upsertTicket(ticket, zendeskTicketId = null, client = { query }) {
    await client.query(
      `
        INSERT INTO tickets (
          id, subject, status, priority, category, product_area, customer_impact,
          requester, assignee, tags, messages, source, zendesk_ticket_id, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb, $12, $13,
          COALESCE($14::timestamptz, now()),
          COALESCE($15::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
          subject = EXCLUDED.subject,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          category = EXCLUDED.category,
          product_area = EXCLUDED.product_area,
          customer_impact = EXCLUDED.customer_impact,
          requester = EXCLUDED.requester,
          assignee = EXCLUDED.assignee,
          tags = EXCLUDED.tags,
          messages = EXCLUDED.messages,
          source = EXCLUDED.source,
          zendesk_ticket_id = COALESCE(EXCLUDED.zendesk_ticket_id, tickets.zendesk_ticket_id),
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        ticket.id,
        ticket.subject,
        ticket.status,
        ticket.priority,
        ticket.category,
        ticket.productArea ?? null,
        ticket.customerImpact ?? null,
        ticket.requester,
        ticket.assignee ?? null,
        ticket.tags ?? [],
        JSON.stringify(ticket.messages ?? []),
        ticket.source ?? null,
        zendeskTicketId,
        ticket.createdAt ?? null,
        ticket.updatedAt ?? null,
      ],
    )
    return ticket
  }

  async function getResource(key) {
    if (key === 'users') return getUsers()
    if (key === 'tickets') return getTickets()
    const res = await query('SELECT value FROM app_resources WHERE key = $1', [key])
    return res.rows[0]?.value ?? fallbackFor(key)
  }

  async function putResource(key, value) {
    if (key === 'users') return replaceUsers(value)
    if (key === 'tickets') return replaceTickets(value)
    await query(
      `
        INSERT INTO app_resources (key, value, updated_at)
        VALUES ($1, $2::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `,
      [key, JSON.stringify(value ?? fallbackFor(key))],
    )
    return value
  }

  async function bootstrap(resources) {
    if (await isEmpty()) {
      await transaction(async (client) => {
        for (const user of resources?.users ?? []) await upsertUser(user, client)
        for (const ticket of resources?.tickets ?? []) await upsertTicket(ticket, null, client)
        for (const key of jsonResourceKeys) {
          if (key in (resources ?? {})) {
            await client.query(
              `
                INSERT INTO app_resources (key, value, updated_at)
                VALUES ($1, $2::jsonb, now())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
              `,
              [key, JSON.stringify(resources[key] ?? fallbackFor(key))],
            )
          }
        }
      })
    }
    return publicData()
  }

  async function publicData() {
    const entries = []
    for (const key of allowedResources) {
      entries.push([key, await getResource(key)])
    }
    return Object.fromEntries(entries)
  }

  async function transaction(fn) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  return {
    init,
    health,
    bootstrap,
    getUserByEmail,
    getTickets,
    upsertTicket,
    getResource,
    putResource,
  }
}

function rowToTicket(row) {
  return {
    id: row.id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    category: row.category,
    productArea: row.productArea ?? undefined,
    customerImpact: row.customerImpact ?? undefined,
    requester: row.requester,
    assignee: row.assignee ?? undefined,
    tags: row.tags ?? [],
    messages: row.messages ?? [],
    source: row.source ?? undefined,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

function fallbackFor(key) {
  if (key === 'calc' || key === 'calc.latest') return null
  return []
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : value
}
