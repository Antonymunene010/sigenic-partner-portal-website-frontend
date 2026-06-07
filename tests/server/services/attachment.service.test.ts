import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createAttachment, getAttachment } from '../../../server/services/attachment.service'
import type { Store } from '../../../server/db/store'
import type { AuthPayload } from '../../../server/infra/auth'

const admin: AuthPayload = { sub: 'u-1', role: 'admin', userType: 'internal', companyId: 'co-sigenic', companyType: 'sigenic', email: 'a@b.c', name: 'Admin' }
const customer: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }

function fakeStore(rows: Record<string, any> = {}) {
  const saved: any[] = []
  const store = {
    insertAttachment: mock.fn(async (rec: any) => {
      saved.push(rec)
    }),
    getAttachment: mock.fn(async (id: string) => rows[id] ?? null),
  } as unknown as Store
  return { store, saved }
}

test('attachment.createAttachment — rejects users without content permissions', async () => {
  const { store, saved } = fakeStore()
  await assert.rejects(
    () => createAttachment(store, customer, Buffer.from([1, 2, 3]), { filename: 'a.png', mimeType: 'image/png' }),
    /allowed/i,
  )
  assert.equal(saved.length, 0)
})

test('attachment.createAttachment — rejects an empty upload', async () => {
  const { store } = fakeStore()
  await assert.rejects(
    () => createAttachment(store, admin, Buffer.alloc(0), { filename: 'a.png', mimeType: 'image/png' }),
    /empty/i,
  )
})

test('attachment.createAttachment — rejects a file over the 25MB limit', async () => {
  const { store } = fakeStore()
  const tooBig = Buffer.alloc(25 * 1024 * 1024 + 1)
  await assert.rejects(
    () => createAttachment(store, admin, tooBig, { filename: 'big.bin', mimeType: 'application/octet-stream' }),
    /too large/i,
  )
})

test('attachment.createAttachment — stores bytes and returns a stable embed URL', async () => {
  const { store, saved } = fakeStore()
  const data = Buffer.from([1, 2, 3, 4, 5])
  const result = await createAttachment(store, admin, data, { filename: 'photo.png', mimeType: 'image/png' })
  assert.equal(saved.length, 1)
  assert.equal(saved[0].sizeBytes, 5)
  assert.equal(saved[0].mimeType, 'image/png')
  assert.equal(saved[0].createdBy, 'u-1')
  assert.equal(result.sizeBytes, 5)
  assert.equal(result.url, `/api/attachments/${result.id}`)
  assert.equal(result.filename, 'photo.png')
})

test('attachment.getAttachment — 404s on a missing id', async () => {
  const { store } = fakeStore()
  await assert.rejects(() => getAttachment(store, 'nope'), /not found/i)
})

test('attachment.getAttachment — returns the stored asset bytes', async () => {
  const asset = { filename: 'f.pdf', mimeType: 'application/pdf', data: Buffer.from([9, 9]) }
  const { store } = fakeStore({ 'asset-x': asset })
  const got = await getAttachment(store, 'asset-x')
  assert.equal(got.mimeType, 'application/pdf')
  assert.equal(got.data.length, 2)
})
