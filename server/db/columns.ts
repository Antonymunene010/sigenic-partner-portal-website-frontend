/**
 * Column-aware SQL builders + key-case helpers, introspected from the live DB.
 *
 * These are pure functions (column metadata is passed in), so they're unit-tested
 * directly. Load-bearing asymmetry: reads come back camelCase + ISO strings
 * (rowToObj) — the frontend contract in shared/types.ts depends on it — while
 * writes accept either case via pick(). Do not "tidy" this.
 */

export interface ColumnMeta {
  name: string
  isJson: boolean
}
export type ColumnMap = Record<string, ColumnMeta[]>

export const toCamel = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const isDate = (v: unknown): v is Date => v instanceof Date

/** Convert a raw DB row (snake_case, Date objects) to the camelCase + ISO-string API shape. */
export function rowToObj(row: Record<string, unknown> | null | undefined): any {
  if (!row) return row
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = isDate(v) ? v.toISOString() : v
  return out
}

/**
 * Columns dropped from generic reads/writes before a row reaches the API layer,
 * keyed by table in camelCase (post-rowToObj). The login path reads the hash via
 * a hand-written query (getUserAuthByEmail) that bypasses this, by design.
 */
export const SENSITIVE_COLUMNS: Record<string, string[]> = { users: ['passwordHash'] }

/** rowToObj for a known table, with that table's sensitive columns stripped. */
export function toApiRow(table: string, row: Record<string, unknown> | null | undefined): any {
  const obj = rowToObj(row)
  if (obj) for (const k of SENSITIVE_COLUMNS[table] ?? []) delete obj[k]
  return obj
}

/** Read a field from a payload accepting either snake_case or camelCase keys. */
export function pick(data: Record<string, unknown>, snake: string): unknown {
  if (data[snake] !== undefined) return data[snake]
  const camel = toCamel(snake)
  return data[camel]
}

/** Build a parameterised INSERT for the columns that actually exist on `table`. */
export function buildInsert(table: string, data: Record<string, unknown>, cols: ColumnMap): { text: string; values: unknown[] } {
  const tableCols = cols[table] ?? []
  const names: string[] = []
  const placeholders: string[] = []
  const values: unknown[] = []
  let i = 1
  for (const col of tableCols) {
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

/**
 * Build a parameterised UPDATE, or null when no known column was supplied (the
 * caller treats null as a no-op and returns the row unchanged). `opts.touch ===
 * false` skips the updated_at bump (used by inline status toggles so a quick
 * deactivate doesn't reorder update-time-sorted lists).
 */
export function buildUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
  cols: ColumnMap,
  opts: { touch?: boolean } = {},
): { text: string; values: unknown[] } | null {
  const tableCols = cols[table] ?? []
  const sets: string[] = []
  const values: unknown[] = []
  let i = 1
  const hasUpdatedAt = tableCols.some((c) => c.name === 'updated_at')
  for (const col of tableCols) {
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
  if (!sets.length) return null
  if (hasUpdatedAt && opts.touch !== false) sets.push('updated_at = now()')
  values.push(id)
  return { text: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values }
}

/** Introspect column metadata (name + jsonb-ness) for every public table. */
export async function loadColumns(
  query: (text: string) => Promise<{ rows: Array<{ table_name: string; column_name: string; data_type: string }> }>,
): Promise<ColumnMap> {
  const res = await query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY ordinal_position
  `)
  const cols: ColumnMap = {}
  for (const r of res.rows) {
    ;(cols[r.table_name] ??= []).push({ name: r.column_name, isJson: r.data_type === 'jsonb' })
  }
  return cols
}
