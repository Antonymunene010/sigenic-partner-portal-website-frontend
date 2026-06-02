import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createAnnouncement } from '../announcement.service'
import { createUser } from '../user.service'
import { createServiceRequest, updateServiceRequest } from '../serviceRequest.service'
import { activateScoringModel } from '../admin.service'
import type { Store } from '../../db/store'
import type { AuthPayload } from '../../infra/auth'

const superAdmin: AuthPayload = { sub: 'u-1', role: 'super_admin', userType: 'internal', companyId: 'co-sigenic', companyType: 'sigenic', email: 'a@b.c', name: 'Admin' }
const admin: AuthPayload = { ...superAdmin, role: 'admin' }

test('announcement.createAnnouncement — fans out only to the matching audience', async () => {
  const users = [
    { id: 'u-int', email: 'int@x', userType: 'internal', role: 'admin', companyId: 'co-s' },
    { id: 'u-cust', email: 'cust@x', userType: 'customer', role: 'customer_user', companyId: 'co-c' },
    { id: 'u-dist', email: 'dist@x', userType: 'distributor', role: 'distributor_user', companyId: 'co-d' },
  ]
  const notifications: any[] = []
  const emails: any[] = []
  const store = {
    insert: mock.fn(async (table: string, data: any) => {
      if (table === 'announcements') return { id: 'ann-1', title: data.title, body: data.body, audienceType: data.audience_type }
      if (table === 'notifications') notifications.push(data)
      return data
    }),
    list: mock.fn(async () => users),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => {
      emails.push(rec)
    }),
  } as unknown as Store

  const result = await createAnnouncement(store, superAdmin, { title: 'T', body: 'B', audienceType: 'customer' })
  assert.equal(result.recipients, 1) // only the one customer user
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].user_id, 'u-cust')
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'cust@x')
})

test('announcement.createAnnouncement — audience "all" reaches everyone', async () => {
  const users = [
    { id: 'u-int', email: 'int@x', userType: 'internal', role: 'admin' },
    { id: 'u-cust', email: 'cust@x', userType: 'customer', role: 'customer_user' },
  ]
  const store = {
    insert: mock.fn(async (table: string, data: any) => (table === 'announcements' ? { id: 'ann-2', audienceType: data.audience_type, title: data.title, body: data.body } : data)),
    list: mock.fn(async () => users),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  const result = await createAnnouncement(store, superAdmin, { title: 'T', body: 'B', audienceType: 'all' })
  assert.equal(result.recipients, 2)
})

test('user.createUser — admin cannot create an internal Sigenic user (PRD §5.1)', async () => {
  const store = { createUser: mock.fn(), appendAudit: mock.fn() } as unknown as Store
  await assert.rejects(
    () => createUser(store, admin, { email: 'x@y.z', fullName: 'X', role: 'support_engineer', companyId: 'co-sigenic' }),
    /role\/company/,
  )
  assert.equal((store.createUser as any).mock.callCount(), 0)
})

test('user.createUser — admin may create an external customer user', async () => {
  const store = { createUser: mock.fn(async () => ({ id: 'u-new', email: 'x@y.z', role: 'customer_user' })), appendAudit: mock.fn(async () => {}) } as unknown as Store
  const result = await createUser(store, admin, { email: 'x@y.z', fullName: 'X', role: 'customer_user', companyId: 'co-c' })
  assert.equal(result.id, 'u-new')
  assert.equal((store.createUser as any).mock.callCount(), 1)
})

test('admin.activateScoringModel — archives other active models, activates the target', async () => {
  const updates: any[] = []
  const store = {
    list: mock.fn(async () => [{ id: 'sm-old', status: 'active' }]),
    update: mock.fn(async (_table: string, id: string, data: any) => {
      updates.push({ id, data })
      return { id, ...data }
    }),
    appendAudit: mock.fn(async () => {}),
  } as unknown as Store
  await activateScoringModel(store, superAdmin, 'sm-target')
  assert.deepStrictEqual(updates.find((u) => u.id === 'sm-old').data, { status: 'archived' })
  assert.deepStrictEqual(updates.find((u) => u.id === 'sm-target').data, { status: 'active' })
})

test('user.createUser — sends an invite email to the new user', async () => {
  const emails: any[] = []
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user' })),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await createUser(store, admin, { email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c' })
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'new@x')
  assert.match(emails[0].subject, /invited/i)
})

test('serviceRequest.createServiceRequest — every type captures a first message (no Zendesk env ⇒ mock)', async () => {
  const inserts: any[] = []
  const store = {
    insert: mock.fn(async (table: string, data: any) => { inserts.push({ table, data }); return { id: 'sr-1', ...data, requestType: data.request_type, ownerTeam: data.owner_team } }),
    ownerTeamFor: mock.fn(() => 'sales'),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  const customer: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  await createServiceRequest(store, customer, { requestType: 'consultation', title: 'Need help', description: 'details' })
  const sr = inserts.find((i) => i.table === 'service_requests')
  assert.ok(sr) // a non-support type used to get messages: [] — now always a first message
  assert.equal(sr.data.messages.length, 1)
  assert.equal(sr.data.messages[0].body, 'details')
})

test('serviceRequest.updateServiceRequest — notifies the requester on status change', async () => {
  const notifications: any[] = []
  const emails: any[] = []
  const before = { id: 'sr-9', status: 'open', ownerTeam: 'support', companyId: 'co-c', userId: 'u-c', contactEmail: 'c@x', title: 'T' }
  const store = {
    getOne: mock.fn(async () => before),
    update: mock.fn(async (_t: string, _id: string, patch: any) => ({ ...before, ...patch })),
    insert: mock.fn(async (table: string, data: any) => { if (table === 'notifications') notifications.push(data); return data }),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await updateServiceRequest(store, superAdmin, 'sr-9', { status: 'solved' })
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].user_id, 'u-c')
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'c@x')
})
