import { Pool } from 'pg'
import { hashPassword } from './auth.js'
import { SCHEMA_SQL, LEGACY_CHECK_SQL, LEGACY_DROP_SQL } from './schema.js'
import { SEED } from './seed.js'
import { isInternal, audienceMatches, can } from '../shared/permissions'

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'demo'

/* ----- key-case helpers ----- */
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const isDate = (v) => v instanceof Date
const rowToObj = (row) => {
  if (!row) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = isDate(v) ? v.toISOString() : v
  return out
}
const pick = (data, snake) => {
  if (data[snake] !== undefined) return data[snake]
  const camel = toCamel(snake)
  return data[camel]
}

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

  /** column metadata per table: { name, isJson } — introspected after init. */
  const COLS = {}

  async function loadColumns() {
    const res = await query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY ordinal_position
    `)
    for (const r of res.rows) {
      ;(COLS[r.table_name] ??= []).push({ name: r.column_name, isJson: r.data_type === 'jsonb' })
    }
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

  /* ----- generic CRUD ----- */

  function buildInsert(table, data) {
    const cols = COLS[table] ?? []
    const names = []
    const placeholders = []
    const values = []
    let i = 1
    for (const col of cols) {
      const v = pick(data, col.name)
      if (v === undefined) continue
      names.push(col.name)
      if (col.isJson) {
        placeholders.push(`$${i}::jsonb`)
        values.push(v === null ? null : JSON.stringify(v))
      } else {
        placeholders.push(`$${i}`)
        values.push(v)
      }
      i++
    }
    return { text: `INSERT INTO ${table} (${names.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`, values }
  }

  async function insert(table, data, client = { query }) {
    const { text, values } = buildInsert(table, data)
    const res = await client.query(text, values)
    return rowToObj(res.rows[0])
  }

  // `opts.touch === false` skips the updated_at bump — used by inline status toggles so they don't
  // reorder update-time-sorted lists (a quick deactivate shouldn't count as a content edit).
  async function update(table, id, data, opts = {}) {
    const cols = COLS[table] ?? []
    const sets = []
    const values = []
    let i = 1
    const hasUpdatedAt = cols.some((c) => c.name === 'updated_at')
    for (const col of cols) {
      if (col.name === 'id' || col.name === 'created_at' || col.name === 'updated_at') continue
      const v = pick(data, col.name)
      if (v === undefined) continue
      if (col.isJson) {
        sets.push(`${col.name} = $${i}::jsonb`)
        values.push(v === null ? null : JSON.stringify(v))
      } else {
        sets.push(`${col.name} = $${i}`)
        values.push(v)
      }
      i++
    }
    if (!sets.length) return getOne(table, id)
    if (hasUpdatedAt && opts.touch !== false) sets.push('updated_at = now()')
    values.push(id)
    const res = await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values)
    return rowToObj(res.rows[0])
  }

  async function list(table, { where = '', params = [], order = '' } = {}) {
    const res = await query(`SELECT * FROM ${table} ${where ? 'WHERE ' + where : ''} ${order ? 'ORDER BY ' + order : ''}`, params)
    return res.rows.map(rowToObj)
  }

  async function getOne(table, id) {
    const res = await query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id])
    return res.rows[0] ? rowToObj(res.rows[0]) : null
  }

  async function remove(table, id) {
    const res = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id])
    return res.rowCount > 0
  }

  /* ----- init + seed ----- */

  async function init() {
    // Drop legacy 2-role tables if present and the new schema hasn't been created.
    const legacy = (await query(LEGACY_CHECK_SQL)).rows[0]
    if (!legacy.has_companies && (legacy.has_legacy_resources || legacy.has_legacy_users)) {
      await query(LEGACY_DROP_SQL)
      console.log('[store] dropped legacy pre-PRD tables (fresh PRD schema)')
    }
    await query(SCHEMA_SQL)
    await loadColumns()
    await seedIfEmpty()
  }

  async function seedIfEmpty() {
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
        for (const row of SEED[table] ?? []) {
          const data = { ...row }
          if (table === 'users') data.password_hash = hashPassword(DEFAULT_PASSWORD)
          await insert(table, data, client)
        }
      }
    })
    console.log('[store] seeded demo data')
  }

  async function health() {
    const res = await query('select current_database() as database, current_schema() as schema')
    return res.rows[0]
  }

  /* ----- auth ----- */

  async function getUserAuthByEmail(email) {
    const res = await query(
      `SELECT u.*, c.company_name, c.company_type
       FROM users u LEFT JOIN companies c ON c.id = u.company_id
       WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email],
    )
    if (!res.rows[0]) return null
    const u = rowToObj(res.rows[0])
    return u // includes passwordHash, companyType, companyName
  }

  async function getUserById(id) {
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

  async function setLastLogin(id) {
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id])
  }

  async function setPassword(id, password) {
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hashPassword(password), id])
    return getUserById(id)
  }

  async function createUser(data, password) {
    const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [data.email])
    if (existing.rows[0]) throw new Error('A user with that email already exists.')
    const payload = { ...data, password_hash: hashPassword(password || DEFAULT_PASSWORD) }
    return insert('users', payload)
  }

  /* ----- scoring resolution ----- */

  async function getActiveScoringModel() {
    const res = await query(`SELECT * FROM scoring_models WHERE status = 'active' ORDER BY effective_from DESC NULLS LAST LIMIT 1`)
    return res.rows[0] ? rowToObj(res.rows[0]) : null
  }

  async function getRulesForModel(modelId) {
    return list('scoring_rules', { where: 'scoring_model_id = $1', params: [modelId] })
  }

  /** Resolve the most specific financial assumption: site → company → global. */
  async function resolveAssumption(modelId, companyId, siteId) {
    const rows = await list('financial_assumptions', { where: 'scoring_model_id = $1', params: [modelId] })
    const score = (a) => (a.siteId === siteId && siteId ? 3 : 0) + (a.companyId === companyId && companyId ? 2 : 0) + (!a.companyId && !a.siteId ? 1 : 0)
    let best = null
    let bestScore = -1
    for (const a of rows) {
      const s = score(a)
      if (s > bestScore) {
        best = a
        bestScore = s
      }
    }
    return best
  }

  /* ----- service requests ----- */

  const OWNER_TEAM_BY_TYPE = {
    support: 'support',
    demo: 'sales',
    consultation: 'sales',
    onboarding: 'ops',
    feature_request: 'product',
  }

  function ownerTeamFor(type) {
    return OWNER_TEAM_BY_TYPE[type] ?? 'support'
  }

  async function getServiceRequestById(id) {
    return getOne('service_requests', id)
  }

  async function addServiceRequestMessage(id, message, newStatus) {
    const sr = await getServiceRequestById(id)
    if (!sr) return null
    const messages = [...(sr.messages ?? []), message]
    return update('service_requests', id, { messages, ...(newStatus ? { status: newStatus } : {}) })
  }

  async function getZendeskLinkedRequests() {
    return list('service_requests', { where: 'zendesk_ticket_id IS NOT NULL', params: [] })
  }

  /** Merge a Zendesk sync result (status + new public comments) into a service request thread. */
  async function applyZendeskSync(zendeskTicketId, sync) {
    const res = await query('SELECT * FROM service_requests WHERE zendesk_ticket_id = $1 LIMIT 1', [zendeskTicketId])
    if (!res.rows[0]) return null
    const sr = rowToObj(res.rows[0])
    const messages = sr.messages ?? []
    const known = new Set(messages.map((m) => m.zendeskCommentId).filter(Boolean))
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
    const patch = {}
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
  async function upsertNotionArticle(article) {
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

  async function appendAudit(entry) {
    return insert('audit_logs', entry)
  }

  async function appendEmail(record) {
    return insert('email_outbox', {
      id: record.id,
      to_email: record.to,
      subject: record.subject,
      body: record.body ?? record.text ?? '',
      mode: record.mode,
    })
  }

  async function getEmails() {
    return list('email_outbox', { order: 'created_at DESC' })
  }

  /** Fan an announcement out to in-app notifications. Returns the matched users
   *  so the caller can reuse them (e.g. for the email broadcast) without re-querying. */
  async function notifyUsers(audienceType, notification) {
    const users = await list('users', { order: 'created_at DESC' })
    const targets = users.filter((u) => audienceMatches(u, audienceType))
    await Promise.all(
      targets.map((u) =>
        insert('notifications', {
          id: `ntf-${u.id}-${notification.refId}`.slice(0, 60),
          user_id: u.id,
          company_id: u.companyId,
          kind: notification.kind ?? 'announcement',
          title: notification.title,
          body: notification.body,
          link: notification.link ?? null,
        }).catch(() => {}),
      ),
    )
    return targets
  }

  /** Mark all of a user's notifications read in one statement. */
  async function markNotificationsRead(userId) {
    await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [userId])
  }

  /* ----- role-scoped hydrate bundle for the frontend ----- */

  async function hydrateFor(user) {
    const me = await getUserById(user.sub ?? user.id)
    const internal = isInternal(me)
    const companyId = me?.companyId ?? null
    const scoped = { where: 'company_id = $1', params: [companyId] }

    // All queries below are independent given `me`/`companyId`, so fire them
    // concurrently (pg pools the connections) instead of ~20 serial round-trips.
    const [
      company,
      companiesAll,
      sites,
      users,
      departments,
      processes,
      machines,
      scoringModels,
      scoringRules,
      financialAssumptions,
      calculatorRuns,
      serviceRequests,
      allArticles,
      allStories,
      allAnnouncements,
      invoices,
      notifications,
      auditLogs,
    ] = await Promise.all([
      companyId ? getOne('companies', companyId) : Promise.resolve(null),
      internal ? list('companies', { order: 'company_name ASC' }) : Promise.resolve(null),
      internal ? list('sites', { order: 'site_name ASC' }) : list('sites', scoped),
      internal ? list('users', { order: 'full_name ASC' }) : list('users', { ...scoped, order: 'full_name ASC' }),
      list('departments', { order: 'name ASC' }),
      list('processes', { order: 'process_name ASC' }),
      list('machines', { order: 'machine_name ASC' }),
      // internal: full config; external: only the active model summary
      internal ? list('scoring_models', { order: 'created_at DESC' }) : getActiveScoringModel().then((m) => (m ? [m] : [])),
      internal ? list('scoring_rules', { order: 'created_at ASC' }) : Promise.resolve([]),
      internal ? list('financial_assumptions', {}) : Promise.resolve([]),
      internal ? list('calculator_runs', { order: 'created_at DESC' }) : list('calculator_runs', { ...scoped, order: 'created_at DESC' }),
      internal ? list('service_requests', { order: 'updated_at DESC' }) : list('service_requests', { ...scoped, order: 'updated_at DESC' }),
      list('knowledge_articles', { order: 'updated_at DESC' }),
      list('success_stories', { order: 'published_at DESC NULLS LAST' }),
      list('announcements', { order: 'pinned DESC, publish_at DESC' }),
      internal ? list('invoices', { order: 'issued_at DESC' }) : list('invoices', { ...scoped, order: 'issued_at DESC' }),
      list('notifications', { where: 'user_id = $1', params: [me?.id], order: 'created_at DESC' }),
      can(me, 'view_audit_logs') ? list('audit_logs', { order: 'created_at DESC' }) : Promise.resolve([]),
    ])

    const companies = internal ? companiesAll : company ? [company] : []
    const activeModel = (internal ? scoringModels.find((m) => m.status === 'active') : scoringModels[0]) ?? null
    const knowledgeArticles = internal ? allArticles : allArticles.filter((a) => a.active && audienceMatches(me, a.audienceType))
    const successStories = internal ? allStories : allStories.filter((s) => s.status === 'published' && s.visibility !== 'internal')
    const now = Date.now()
    const announcements = internal
      ? allAnnouncements
      : allAnnouncements.filter(
          (a) =>
            a.active &&
            audienceMatches(me, a.audienceType) &&
            (!a.publishAt || new Date(a.publishAt).getTime() <= now) &&
            (!a.expireAt || new Date(a.expireAt).getTime() >= now) &&
            (!a.companyId || a.companyId === companyId),
        )

    return {
      me,
      company,
      companies,
      sites,
      users,
      departments,
      processes,
      machines,
      scoringModels,
      scoringRules,
      financialAssumptions,
      activeScoringModelId: activeModel?.id ?? null,
      calculatorRuns,
      serviceRequests,
      knowledgeArticles,
      successStories,
      announcements,
      invoices,
      notifications,
      auditLogs,
    }
  }

  /** Public (unauthenticated) bundle for the marketing site. */
  async function publicBundle() {
    const stories = (await list('success_stories', { order: 'published_at DESC NULLS LAST' })).filter(
      (s) => s.status === 'published' && s.visibility === 'public',
    )
    const articles = (await list('knowledge_articles', { order: 'updated_at DESC' })).filter(
      (a) => a.active && a.featured && a.audienceType === 'all',
    )
    return { successStories: stories, knowledgeArticles: articles }
  }

  return {
    // lifecycle
    init,
    health,
    transaction,
    // generic
    insert,
    update,
    list,
    getOne,
    remove,
    rowToObj,
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
    getServiceRequestById,
    addServiceRequestMessage,
    getZendeskLinkedRequests,
    applyZendeskSync,
    upsertNotionArticle,
    // audit / email / notifications
    appendAudit,
    appendEmail,
    getEmails,
    notifyUsers,
    markNotificationsRead,
    // bundles
    hydrateFor,
    publicBundle,
  }
}
