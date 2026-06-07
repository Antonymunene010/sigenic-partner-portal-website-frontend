import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCamel, rowToObj, pick, buildInsert, buildUpdate, toApiRow, type ColumnMap } from '../../../server/db/columns'

const COLS: ColumnMap = {
  widgets: [
    { name: 'id', isJson: false },
    { name: 'company_id', isJson: false },
    { name: 'tags_json', isJson: true },
    { name: 'created_at', isJson: false },
    { name: 'updated_at', isJson: false },
  ],
}

test('toCamel — snake_case to camelCase', () => {
  assert.equal(toCamel('company_id'), 'companyId')
  assert.equal(toCamel('tags_json'), 'tagsJson')
  assert.equal(toCamel('id'), 'id')
  assert.equal(toCamel('last_reviewed_at'), 'lastReviewedAt')
})

test('rowToObj — snake→camel, Date→ISO, null passthrough', () => {
  assert.deepStrictEqual(
    rowToObj({ company_id: 'c1', tags_json: ['a'], created_at: new Date('2026-01-01T00:00:00Z'), avatar: null }),
    { companyId: 'c1', tagsJson: ['a'], createdAt: '2026-01-01T00:00:00.000Z', avatar: null },
  )
  assert.equal(rowToObj(null), null)
  assert.equal(rowToObj(undefined), undefined)
})

test('toApiRow — strips password_hash for users, passes other tables through', () => {
  // users: password_hash must never reach the API layer (login uses a separate query)
  assert.deepStrictEqual(
    toApiRow('users', { id: 'u1', email: 'a@b.com', password_hash: 'scrypt$secret', role: 'admin' }),
    { id: 'u1', email: 'a@b.com', role: 'admin' },
  )
  // non-sensitive table is untouched (still snake→camel)
  assert.deepStrictEqual(toApiRow('companies', { id: 'c1', company_name: 'Acme' }), { id: 'c1', companyName: 'Acme' })
  // null/undefined passthrough
  assert.equal(toApiRow('users', null), null)
  assert.equal(toApiRow('users', undefined), undefined)
})

test('pick — snake key first, camelCase fallback, undefined when absent', () => {
  assert.equal(pick({ company_id: 'x' }, 'company_id'), 'x')
  assert.equal(pick({ companyId: 'y' }, 'company_id'), 'y') // camel fallback
  assert.equal(pick({}, 'company_id'), undefined)
})

test('buildInsert — only existing columns, $n placeholders, ::jsonb + JSON.stringify on json cols', () => {
  const { text, values } = buildInsert('widgets', { id: 'w1', company_id: 'c1', tags_json: ['a', 'b'], bogus: 'ignored' }, COLS)
  assert.equal(text, 'INSERT INTO widgets (id, company_id, tags_json) VALUES ($1, $2, $3::jsonb) RETURNING *')
  assert.deepStrictEqual(values, ['w1', 'c1', '["a","b"]'])
})

test('buildInsert — null json column stays null (not stringified)', () => {
  const { text, values } = buildInsert('widgets', { id: 'w1', tags_json: null }, COLS)
  assert.equal(text, 'INSERT INTO widgets (id, tags_json) VALUES ($1, $2::jsonb) RETURNING *')
  assert.deepStrictEqual(values, ['w1', null])
})

test('buildUpdate — sets, ::jsonb, bumps updated_at, id is the last placeholder', () => {
  const built = buildUpdate('widgets', 'w1', { company_id: 'c2', tags_json: ['x'] }, COLS, {})
  assert.ok(built)
  assert.equal(built.text, 'UPDATE widgets SET company_id = $1, tags_json = $2::jsonb, updated_at = now() WHERE id = $3 RETURNING *')
  assert.deepStrictEqual(built.values, ['c2', '["x"]', 'w1'])
})

test('buildUpdate — touch:false skips the updated_at bump', () => {
  const built = buildUpdate('widgets', 'w1', { company_id: 'c2' }, COLS, { touch: false })
  assert.ok(built)
  assert.equal(built.text, 'UPDATE widgets SET company_id = $1 WHERE id = $2 RETURNING *')
  assert.deepStrictEqual(built.values, ['c2', 'w1'])
})

test('buildUpdate — never writes id/created_at/updated_at from the payload', () => {
  const built = buildUpdate('widgets', 'w1', { id: 'hacked', created_at: 'x', updated_at: 'y', company_id: 'c3' }, COLS, { touch: false })
  assert.ok(built)
  assert.equal(built.text, 'UPDATE widgets SET company_id = $1 WHERE id = $2 RETURNING *')
  assert.deepStrictEqual(built.values, ['c3', 'w1'])
})

test('buildUpdate — no known columns ⇒ null (caller treats as no-op)', () => {
  assert.equal(buildUpdate('widgets', 'w1', { bogus: 'nope' }, COLS, {}), null)
})
