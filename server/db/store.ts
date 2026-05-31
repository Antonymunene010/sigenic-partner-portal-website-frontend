import type { PoolClient, QueryResult } from 'pg'
import { hashPassword } from '../infra/auth'
import { SCHEMA_SQL, LEGACY_CHECK_SQL, LEGACY_DROP_SQL } from './schema'
import { SEED } from './seed'
import { createPool, transaction as runTransaction } from './pool'
import { buildInsert, buildUpdate, rowToObj, loadColumns, type ColumnMap } from './columns'

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'demo'

/** Anything exposing a pg-style query() — the pool itself or a transaction client. */
type Queryable = { query: (text: string, params?: any[]) => Promise<QueryResult> }

/**
 * The data-access layer: generic CRUD + hand-written queries. Pure persistence —
 * no permission/audience filtering lives here (that's the service layer's job).
 */
export function createStore() {
  const pool = createPool()
  const query = (text: string, params?: any[]) => pool.query(text, params)

  /** column metadata per table: { name, isJson } — introspected after init. */
  let COLS: ColumnMap = {}

  function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    return runTransaction(pool, fn)
  }

  /* ----- generic CRUD ----- */

  async function insert(table: string, data: Record<string, unknown>, client: Queryable = { query }): Promise<any> {
    const { text, values } = buildInsert(table, data, COLS)
    const res = await client.query(text, values)
    return rowToObj(res.rows[0])
  }

  // `opts.touch === false` skips the updated_at bump — used by inline status toggles so they don't
  // reorder update-time-sorted lists (a quick deactivate shouldn't count as a content edit).
  async function update(table: string, id: string, data: Record<string, unknown>, opts: { touch?: boolean } = {}): Promise<any> {
    const built = buildUpdate(table, id, data, COLS, opts)
    if (!built) return getOne(table, id)
    const res = await query(built.text, built.values)
    return rowToObj(res.rows[0])
  }

  async function list(table: string, { where = '', params = [], order = '' }: { where?: string; params?: any[]; order?: string } = {}): Promise<any[]> {
    const res = await query(`SELECT * FROM ${table} ${where ? 'WHERE ' + where : ''} ${order ? 'ORDER BY ' + order : ''}`, params)
    return res.rows.map(rowToObj)
  }

  async function getOne(table: string, id: string): Promise<any> {
    const res = await query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id])
    return res.rows[0] ? rowToObj(res.rows[0]) : null
  }

  async function remove(table: string, id: string): Promise<boolean> {
    const res = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id])
    return (res.rowCount ?? 0) > 0
  }

  /* ----- init + seed ----- */

  async function init(): Promise<void> {
    // Drop legacy 2-role tables if present and the new schema hasn't been created.
    const legacy = (await query(LEGACY_CHECK_SQL)).rows[0]
    if (!legacy.has_companies && (legacy.has_legacy_resources || legacy.has_legacy_users)) {
      await query(LEGACY_DROP_SQL)
      console.log('[store] dropped legacy pre-PRD tables (fresh PRD schema)')
    }
    await query(SCHEMA_SQL)
    COLS = await loadColumns(query)
    await seedIfEmpty()
  }

  async function seedIfEmpty(): Promise<void> {
    const count = (await query('SELECT count(*)::int AS n FROM companies')).rows[0].n
    if (count > 0) return
    await transaction(async (client) => {
      const order = [
        'companies', 'sites', 'users', 'departments', 'processes', 'machines',
        'scoring_models', 'scoring_rules', 'financial_assumptions', 'success_stories',
        'knowledge_articles', 'announcements', 'invoices', 'calculator_runs',
        'service_requests', 'audit_logs',
      ]
      for (const table of order) {
        for (const row of (SEED as Record<string, any[]>)[table] ?? []) {
          const data = { ...row }
          if (table === 'users') data.password_hash = hashPassword(DEFAULT_PASSWORD)
          await insert(table, data, client)
        }
      }
    })
    console.log('[store] seeded demo data')
  }

  async function health(): Promise<any> {
    const res = await query('select current_database() as database, current_schema() as schema')
    return res.rows[0]
  }

  /* ----- auth ----- */

  async function getUserAuthByEmail(email: string): Promise<any> {
    const res = await query(
      `SELECT u.*, c.company_name, c.company_type
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email],
    )
    if (!res.rows[0]) return null
    return rowToObj(res.rows[0]) // includes passwordHash, companyType, companyName
  }

  async function getUserById(id: string): Promise<any> {
    const res = await query(
      `SELECT u.id, u.company_id, u.site_id, u.full_name, u.email, u.user_type, u.role,
              u.avatar, u.status, u.last_login_at, u.created_at, u.updated_at,
              c.company_name, c.company_type
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1 LIMIT 1`,
      [id],
    )
    return res.rows[0] ? rowToObj(res.rows[0]) : null
  }

  async function setLastLogin(id: string): Promise<void> {
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id])
  }

  async function setPassword(id: string, password: string): Promise<any> {
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hashPassword(password), id])
    return getUserById(id)
  }

  async function createUser(data: Record<string, unknown>, password?: string): Promise<any> {
    const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [data.email])
    if (existing.rows[0]) throw new Error('A user with that email already exists.')
    const payload = { ...data, password_hash: hashPassword(password || DEFAULT_PASSWORD) }
    return insert('users', payload)
  }

  /* ----- scoring resolution ----- */

  async function getActiveScoringModel(): Promise<any> {
    const res = await query(`SELECT * FROM scoring_models WHERE status = 'active' ORDER BY effective_from DESC NULLS LAST LIMIT 1`)
    return res.rows[0] ? rowToObj(res.rows[0]) : null
  }

  async function getRulesForModel(modelId: string): Promise<any[]> {
    return list('scoring_rules', { where: 'scoring_model_id = $1', params: [modelId] })
  }

  /** Resolve the most specific financial assumption: site → company → global. */
  async function resolveAssumption(modelId: string, companyId: string | null | undefined, siteId: string | null | undefined): Promise<any> {
    const rows = await list('financial_assumptions', { where: 'scoring_model_id = $1', params: [modelId] })
    // Most specific wins: site (3) > company (2) > global (1).
    const score = (a: any) => (a.siteId === siteId && siteId ? 3 : 0) + (a.companyId === companyId && companyId ? 2 : 0) + (!a.companyId && !a.siteId ? 1 : 0)
    return rows.reduce<any>((best, a) => (best === null || score(a) > score(best) ? a : best), null)
  }

  /* ----- service requests ----- */

  const OWNER_TEAM_BY_TYPE: Record<string, string> = {
    support: 'support',
    demo: 'sales',
    consultation: 'sales',
    onboarding: 'ops',
    feature_request: 'product',
  }

  function ownerTeamFor(type: string): string {
    return OWNER_TEAM_BY_TYPE[type] ?? 'support'
  }

  async function addServiceRequestMessage(id: string, message: any, newStatus?: string): Promise<any> {
    const sr = await getOne('service_requests', id)
    if (!sr) return null
    const messages = [...(sr.messages ?? []), message]
    return update('service_requests', id, { messages, ...(newStatus ? { status: newStatus } : {}) })
  }

  async function getZendeskLinkedRequests(): Promise<any[]> {
    return list('service_requests', { where: 'zendesk_ticket_id IS NOT NULL', params: [] })
  }

  /** Merge a Zendesk sync result (status + new public comments) into a service request thread. */
  async function applyZendeskSync(zendeskTicketId: string, sync: any): Promise<any> {
    const res = await query('SELECT * FROM service_requests WHERE zendesk_ticket_id = $1 LIMIT 1', [zendeskTicketId])
    if (!res.rows[0]) return null
    const sr = rowToObj(res.rows[0])
    const messages = sr.messages ?? []
    const known = new Set(messages.map((m: any) => m.zendeskCommentId).filter(Boolean))
    const firstBody = messages[0]?.body
    let changed = false
    for (const comment of sync.comments ?? []) {
      if (known.has(comment.zendeskCommentId)) continue
      if (comment.body && firstBody && comment.body.trim() === firstBody.trim()) continue
      messages.push({
        id: `zen-${comment.zendeskCommentId}`,
        author: 'Sigenic (Zendesk)',
        authorRole: 'agent',
        body: comment.body,
        createdAt: comment.createdAt,
        zendeskCommentId: comment.zendeskCommentId,
      })
      changed = true
    }
    const patch: Record<string, unknown> = {}
    if (changed) patch.messages = messages
    if (sync.status && sync.status !== sr.status) {
      patch.status = sync.status
      changed = true
    }
    if (changed) return update('service_requests', sr.id, patch)
    return sr
  }

  /**
   * Upsert a knowledge article pulled from Notion (keyed by source_ref_id).
   * Notion owns the *content* (title/summary/slug/body); the portal owns
   * *governance* (featured/active/audience/category/tags) per PRD §8, so an
   * existing row keeps its locally-edited governance fields on re-sync. First
   * import seeds governance from Notion. Returns 'created' | 'updated'.
   */
  async function upsertNotionArticle(article: any): Promise<'created' | 'updated'> {
    const res = await query(
      `SELECT * FROM knowledge_articles WHERE source_type = 'notion' AND source_ref_id = $1 LIMIT 1`,
      [article.sourceRefId],
    )
    const existing = res.rows[0] ? rowToObj(res.rows[0]) : null
    if (!existing) {
      await insert('knowledge_articles', {
        id: `kb-notion-${String(article.sourceRefId).replace(/-/g, '')}`,
        source_type: 'notion',
        source_ref_id: article.sourceRefId,
        slug: article.slug || null,
        title: article.title,
        summary: article.summary,
        category: article.category,
        tags_json: article.tags ?? [],
        body: article.body,
        active: article.active,
        featured: article.featured,
        audience_type: article.audienceType ?? 'all',
        last_reviewed_at: article.lastReviewedAt ?? null,
      })
      return 'created'
    }
    await update('knowledge_articles', existing.id, {
      title: article.title,
      summary: article.summary,
      slug: existing.slug || article.slug || null,
      body: article.body,
      last_reviewed_at: article.lastReviewedAt ?? existing.lastReviewedAt ?? null,
    })
    return 'updated'
  }

  /* ----- audit / email / notifications ----- */

  async function appendAudit(entry: Record<string, unknown>): Promise<any> {
    return insert('audit_logs', entry)
  }

  async function appendEmail(record: { id: string; to: string; subject: string; text?: string; mode: string }): Promise<any> {
    return insert('email_outbox', {
      id: record.id,
      to_email: record.to,
      subject: record.subject,
      body: record.text ?? '',
      mode: record.mode,
    })
  }

  async function getEmails(): Promise<any[]> {
    return list('email_outbox', { order: 'created_at DESC' })
  }

  /** Mark all of a user's notifications read in one statement. */
  async function markNotificationsRead(userId: string): Promise<void> {
    await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [userId])
  }

  return {
    // lifecycle
    init,
    health,
    // generic CRUD
    insert,
    update,
    list,
    getOne,
    remove,
    // auth
    getUserAuthByEmail,
    getUserById,
    setLastLogin,
    setPassword,
    createUser,
    // scoring
    getActiveScoringModel,
    getRulesForModel,
    resolveAssumption,
    // service requests
    ownerTeamFor,
    addServiceRequestMessage,
    getZendeskLinkedRequests,
    applyZendeskSync,
    upsertNotionArticle,
    // audit / email / notifications
    appendAudit,
    appendEmail,
    getEmails,
    markNotificationsRead,
  }
}

/** The assembled data-access store, dependency-injected into the service layer. */
export type Store = ReturnType<typeof createStore>
