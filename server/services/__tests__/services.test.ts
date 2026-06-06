import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createAnnouncement } from '../announcement.service'
import { createUser, deleteUser } from '../user.service'
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
    insert: mock.fn(async (_table: string, data: any) => ({ id: 'ann-1', title: data.title, body: data.body, audienceType: data.audience_type })),
    appendNotification: mock.fn(async (rec: any) => { notifications.push(rec) }),
    list: mock.fn(async () => users),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => {
      emails.push(rec)
    }),
  } as unknown as Store

  const result = await createAnnouncement(store, superAdmin, { title: 'T', body: 'B', audienceType: 'customer' })
  assert.equal(result.recipients, 1) // only the one customer user
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].userId, 'u-cust')
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'cust@x')
})

test('announcement.createAnnouncement — audience "all" reaches everyone', async () => {
  const users = [
    { id: 'u-int', email: 'int@x', userType: 'internal', role: 'admin' },
    { id: 'u-cust', email: 'cust@x', userType: 'customer', role: 'customer_user' },
  ]
  const store = {
    insert: mock.fn(async (_table: string, data: any) => ({ id: 'ann-2', audienceType: data.audience_type, title: data.title, body: data.body })),
    appendNotification: mock.fn(async () => {}),
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

test('user.createUser — emails a single-use invite link to the new user', async () => {
  const emails: any[] = []
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user' })),
    getUserAuthById: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c', companyName: 'Acme', passwordHash: 'pw-hash', status: 'invited' })),
    list: mock.fn(async () => []), // no internal admins → only the invite goes out
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await createUser(store, admin, { email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c' })
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'new@x')
  assert.match(emails[0].subject, /invited/i)
  assert.match(emails[0].text, /\/reset-password\?token=/) // invite carries a setup link, not a shared password
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
    appendNotification: mock.fn(async (rec: any) => { notifications.push(rec) }),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await updateServiceRequest(store, superAdmin, 'sr-9', { status: 'solved' })
  assert.equal(notifications.length, 1)
  assert.equal(notifications[0].userId, 'u-c')
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'c@x')
})

test('serviceRequest.updateServiceRequest — super_admin re-classifies type + site/department/process/machine', async () => {
  const before = { id: 'sr-10', status: 'open', ownerTeam: 'support', requestType: 'support', companyId: 'co-c' }
  let patched: any = null
  const store = {
    getOne: mock.fn(async () => before),
    update: mock.fn(async (_t: string, _id: string, patch: any) => { patched = patch; return { ...before, ...patch } }),
    appendNotification: mock.fn(async () => {}),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  await updateServiceRequest(store, superAdmin, 'sr-10', { requestType: 'demo', siteId: 'site-1', departmentId: 'dep-1', processId: null, machineId: null })
  // Blank selections normalise to null; request_type is taken verbatim.
  assert.deepEqual(patched, { requestType: 'demo', siteId: 'site-1', departmentId: 'dep-1', processId: null, machineId: null })
})

test('serviceRequest.updateServiceRequest — non-super_admin oversight cannot re-classify', async () => {
  const supportEngineer: AuthPayload = { ...superAdmin, role: 'support_engineer' }
  const before = { id: 'sr-11', status: 'open', ownerTeam: 'support', requestType: 'support', companyId: 'co-c' }
  const store = {
    getOne: mock.fn(async () => before),
    update: mock.fn(async () => before),
    appendAudit: mock.fn(async () => {}),
  } as unknown as Store
  // Support engineers keep status/owner triage, but type/taxonomy is super_admin-only.
  await assert.rejects(() => updateServiceRequest(store, supportEngineer, 'sr-11', { requestType: 'demo' }), /super admin/i)
  assert.equal((store.update as any).mock.callCount(), 0)
})

test('user.createUser — emails the active internal admins that a new user joined', async () => {
  const emails: any[] = []
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user' })),
    getUserAuthById: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c', companyName: 'Acme', passwordHash: 'pw', status: 'invited' })),
    list: mock.fn(async () => [
      { id: 'a1', email: 'boss@sigenic.com', role: 'super_admin', status: 'active' },
      { id: 'a2', email: 'mgr@sigenic.com', role: 'admin', status: 'active' },
      { id: 'x', email: 'cust@x', role: 'customer_user', status: 'active' }, // not an admin
      { id: 'y', email: 'old@sigenic.com', role: 'admin', status: 'inactive' }, // deactivated
    ]),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await createUser(store, admin, { email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c' })
  const adminMails = emails.filter((e) => /^Portal user created/.test(e.subject))
  assert.deepEqual(adminMails.map((e) => e.to).sort(), ['boss@sigenic.com', 'mgr@sigenic.com'])
})

test('user.deleteUser — removes the row and emails the user + internal admins', async () => {
  const emails: any[] = []
  const store = {
    getUserById: mock.fn(async () => ({ id: 'u-del', email: 'gone@x', fullName: 'Gone User', role: 'customer_user', companyId: 'co-c', companyName: 'Acme', status: 'active' })),
    remove: mock.fn(async () => true),
    list: mock.fn(async () => [{ id: 'a1', email: 'boss@sigenic.com', role: 'super_admin', status: 'active' }]),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  const res = await deleteUser(store, superAdmin, 'u-del')
  assert.equal(res.ok, true)
  assert.equal((store.remove as any).mock.callCount(), 1)
  assert.ok(emails.some((e) => e.to === 'gone@x' && /access has been removed/i.test(e.subject))) // removed user
  assert.ok(emails.some((e) => e.to === 'boss@sigenic.com' && /^Portal user deleted/.test(e.subject))) // internal admin
})

test('user.deleteUser — refuses to delete your own account', async () => {
  const store = { remove: mock.fn(async () => true), getUserById: mock.fn(), appendAudit: mock.fn() } as unknown as Store
  await assert.rejects(() => deleteUser(store, superAdmin, superAdmin.sub), /your own account/i)
  assert.equal((store.remove as any).mock.callCount(), 0)
})

test('user.deleteUser — admin cannot delete an internal Sigenic user (PRD §5.1)', async () => {
  const store = {
    getUserById: mock.fn(async () => ({ id: 'u-staff', email: 's@sigenic.com', fullName: 'Staff', role: 'support_engineer', companyId: 'co-sigenic', companyName: 'Sigenic', status: 'active' })),
    remove: mock.fn(async () => true),
    appendAudit: mock.fn(async () => {}),
  } as unknown as Store
  await assert.rejects(() => deleteUser(store, admin, 'u-staff'), /cannot delete/i)
  assert.equal((store.remove as any).mock.callCount(), 0)
})
