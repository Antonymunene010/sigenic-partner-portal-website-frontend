import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createAnnouncement } from '../../../server/services/announcement.service'
import { createUser, deleteUser } from '../../../server/services/user.service'
import { createServiceRequest, updateServiceRequest, addServiceRequestMessage } from '../../../server/services/serviceRequest.service'
import { hydrate } from '../../../server/services/hydrate.service'
import { activateScoringModel } from '../../../server/services/admin.service'
import { calculate, submit } from '../../../server/services/calculator.service'
import type { Store } from '../../../server/db/store'
import type { AuthPayload } from '../../../server/infra/auth'

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

test('calculator.calculate — pure preview: returns a result without persisting a run', async () => {
  const inserts: any[] = []
  const store = {
    getActiveScoringModel: mock.fn(async () => ({ id: 'sm-1', versionName: 'v1' })),
    getOne: mock.fn(async () => null),
    getIssuesForModel: mock.fn(async () => []),
    list: mock.fn(async () => []),
    insert: mock.fn(async (table: string, data: any) => { inserts.push({ table, data }); return { id: data.id, ...data } }),
  } as unknown as Store
  const customer: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  const out = await calculate(store, customer, { selection: { siteId: 'site-1', issues: [] } })
  assert.ok(out.result, 'a computed result is returned to the caller')
  assert.equal(inserts.length, 0, 'calculate must not persist anything — submit() owns persistence')
})

test('calculator.submit — persists the run as a lead and notifies internal admins', async () => {
  const inserts: any[] = []
  const emails: any[] = []
  const store = {
    getActiveScoringModel: mock.fn(async () => ({ id: 'sm-1', versionName: 'v1' })),
    getOne: mock.fn(async () => null),
    getIssuesForModel: mock.fn(async () => []),
    list: mock.fn(async (table: string) => {
      if (table === 'users') return [{ id: 'u-int', email: 'admin@sigenic', role: 'admin', status: 'active' }]
      return []
    }),
    insert: mock.fn(async (table: string, data: any) => { inserts.push({ table, data }); return { id: data.id, ...data } }),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  const customer: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  const { result, runId } = await submit(store, customer, {
    selection: { siteId: 'site-1', issues: [] },
    additional: { preventiveMeasures: 'weekly PM', costsIncurred: '$10k/quarter' },
    clientName: 'Acme Wafer',
  })
  const run = inserts.find((i) => i.table === 'calculator_runs')
  assert.ok(run, 'a calculator_runs row is inserted on submit')
  assert.equal(run.data.run_type, 'partner')
  assert.equal(run.data.user_id, 'u-c')
  assert.equal(run.data.company_id, 'co-c')
  assert.equal(run.data.site_id, 'site-1')
  assert.equal(run.data.client_name, 'Acme Wafer')
  assert.equal(run.data.preventive_measures, 'weekly PM')
  assert.equal(run.data.costs_incurred, '$10k/quarter')
  assert.ok(run.data.submitted_at, 'submitted_at is stamped')
  assert.equal(runId, run.data.id)
  assert.ok(result)
  // Two emails go out (fire-and-forget): the internal-admin lead notification AND
  // the submitter's own confirmation receipt — the client asked for the latter.
  await new Promise((resolve) => setImmediate(resolve)) // flush the fire-and-forget sends
  assert.equal(emails.length, 2, 'admin lead notification + submitter confirmation receipt')
  assert.ok(emails.some((e) => e.to === 'admin@sigenic'), 'the active internal admin is notified of the lead')
  const receipt = emails.find((e) => e.to === 'c@x')
  assert.ok(receipt, 'the submitter receives a confirmation at their own account email')
  assert.match(receipt.subject, /received your risk/i)
})

test('user.createUser — emails a single-use invite link to the new user + a receipt to the inviter', async () => {
  const emails: any[] = []
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user' })),
    getUserAuthById: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c', companyName: 'Acme', passwordHash: 'pw-hash', status: 'invited' })),
    list: mock.fn(async () => []), // no internal admins → only the invite + inviter receipt go out
    appendAudit: mock.fn(async () => {}),
    update: mock.fn(async (_t: string, _id: string, patch: any) => ({ id: 'co-c', ...patch })),
    getOne: mock.fn(async () => ({ id: 'co-c', onboardingStatus: 'not_started' })),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await createUser(store, admin, { email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c' })
  await new Promise((resolve) => setImmediate(resolve)) // flush the fire-and-forget sends
  // The invitee gets the set-password link …
  const invite = emails.find((e) => e.to === 'new@x')
  assert.ok(invite, 'invitee receives the set-password link')
  assert.match(invite.subject, /invited/i)
  assert.match(invite.text, /\/reset-password\?token=/) // invite carries a setup link, not a shared password
  // … and the inviter gets a dedicated receipt (client feedback 2026-06).
  const receipt = emails.find((e) => e.to === admin.email)
  assert.ok(receipt, 'inviter receives a confirmation email')
  assert.match(receipt.subject, /Invite sent to New User/)
})

test('serviceRequest.createServiceRequest — every type captures a first message (no Zendesk env ⇒ mock)', async () => {
  const inserts: any[] = []
  const store = {
    insert: mock.fn(async (table: string, data: any) => { inserts.push({ table, data }); return { id: 'sr-1', ...data, requestType: data.request_type, ownerTeam: data.owner_team } }),
    getRequestTypeBySlug: mock.fn(async (slug: string) => ({ slug, label: 'Consultation', ownerTeam: 'sales', active: true })),
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
  assert.equal(sr.data.owner_team, 'sales') // owner team resolved from the request_types row
})

test('serviceRequest.createServiceRequest — rejects an unknown/inactive request type', async () => {
  const inserts: any[] = []
  const store = {
    insert: mock.fn(async (table: string, data: any) => { inserts.push({ table, data }); return { id: 'sr-x', ...data } }),
    getRequestTypeBySlug: mock.fn(async () => null), // not an active request_types row
    ownerTeamFor: mock.fn(() => 'support'),
    appendAudit: mock.fn(async () => {}),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  const customer: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  await assert.rejects(() => createServiceRequest(store, customer, { requestType: 'made_up', title: 'X', description: 'y' }), /Unknown or inactive request type/)
  assert.equal(inserts.find((i) => i.table === 'service_requests'), undefined) // never inserted
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
    getRequestTypeBySlug: mock.fn(async (slug: string) => ({ slug, ownerTeam: 'sales', active: true })),
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

test('serviceRequest.addServiceRequestMessage — plain external users reply only on their OWN requests', async () => {
  const colleagues = { id: 'sr-m', status: 'open', companyId: 'co-c', userId: 'u-other', contactEmail: 'o@x', title: 'T' }
  const store = {
    getOne: mock.fn(async () => colleagues),
    addServiceRequestMessage: mock.fn(async (_id: string, msg: any, status: string) => ({ ...colleagues, status, messages: [msg] })),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  const plain: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  // A colleague's request in the same company: company-wide replies are an admin privilege.
  await assert.rejects(() => addServiceRequestMessage(store, plain, 'sr-m', 'hello'))
  assert.equal((store.addServiceRequestMessage as any).mock.callCount(), 0)
  // The company admin may reply on any of the company's requests.
  const companyAdmin: AuthPayload = { ...plain, sub: 'u-ca', role: 'customer_admin' }
  await addServiceRequestMessage(store, companyAdmin, 'sr-m', 'hello')
  assert.equal((store.addServiceRequestMessage as any).mock.callCount(), 1)
})

test('serviceRequest.addServiceRequestMessage — the requester themselves may always reply', async () => {
  const own = { id: 'sr-own', status: 'open', companyId: 'co-c', userId: 'u-c', contactEmail: 'c@x', title: 'T' }
  const store = {
    getOne: mock.fn(async () => own),
    addServiceRequestMessage: mock.fn(async (_id: string, msg: any, status: string) => ({ ...own, status, messages: [msg] })),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store
  const plain: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }
  const updated = await addServiceRequestMessage(store, plain, 'sr-own', 'any update?')
  assert.equal(updated.messages[0].body, 'any update?')
})

test('hydrate — plain external users get only their OWN submissions; company admins the whole company\'s', async () => {
  const hydrateStore = (me: any) =>
    ({
      getUserById: mock.fn(async () => me),
      getOne: mock.fn(async () => null),
      getActiveScoringModel: mock.fn(async () => null),
      list: mock.fn(async () => []),
    }) as unknown as Store
  // The where/params each submission table was listed with (mock.fn records the calls).
  const assertScope = (store: Store, expected: { where?: string; params?: any[] }) => {
    for (const table of ['calculator_runs', 'service_requests']) {
      const opts = (store.list as any).mock.calls.find((c: any) => c.arguments[0] === table)?.arguments[1]
      assert.equal(opts?.where, expected.where, table)
      assert.deepEqual(opts?.params, expected.params, table)
    }
  }
  const plainAuth: AuthPayload = { sub: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c', companyType: 'customer', email: 'c@x', name: 'Cust' }

  const plain = hydrateStore({ id: 'u-c', role: 'customer_user', userType: 'customer', companyId: 'co-c' })
  await hydrate(plain, plainAuth)
  assertScope(plain, { where: 'user_id = $1', params: ['u-c'] })

  const admin = hydrateStore({ id: 'u-ca', role: 'customer_admin', userType: 'customer', companyId: 'co-c' })
  await hydrate(admin, { ...plainAuth, sub: 'u-ca', role: 'customer_admin' })
  assertScope(admin, { where: 'company_id = $1', params: ['co-c'] })

  const internal = hydrateStore({ id: 'u-1', role: 'super_admin', userType: 'internal', companyId: 'co-sigenic' })
  await hydrate(internal, superAdmin)
  assertScope(internal, {}) // internal: unscoped
})

test('user.createUser — emails the active internal admins that a new user joined', async () => {
  const emails: any[] = []
  // notifyInternalAdmins now filters at the SQL layer (role = ANY + status <> 'inactive'),
  // so this mock interprets opts.params the same way the DB would, keeping the test honest
  // about the negative cases (customer_user + inactive admin should NOT receive a mail).
  const allUsers = [
    { id: 'a1', email: 'boss@sigenic.com', role: 'super_admin', status: 'active' },
    { id: 'a2', email: 'mgr@sigenic.com', role: 'admin', status: 'active' },
    { id: 'x', email: 'cust@x', role: 'customer_user', status: 'active' },
    { id: 'y', email: 'old@sigenic.com', role: 'admin', status: 'inactive' },
  ]
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user' })),
    getUserAuthById: mock.fn(async () => ({ id: 'u-new', email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c', companyName: 'Acme', passwordHash: 'pw', status: 'invited' })),
    list: mock.fn(async (_table: string, opts?: { params?: any[] }) => {
      if (!opts?.params) return allUsers
      const roles: string[] = opts.params[0]
      // `where: company_id = $1` (lifecycle recompute) → return all users for the company
      if (typeof roles === 'string') return allUsers
      return allUsers.filter((u) => roles.includes(u.role) && u.status !== 'inactive')
    }),
    appendAudit: mock.fn(async () => {}),
    update: mock.fn(async (_t: string, _id: string, patch: any) => ({ id: 'co-c', ...patch })),
    getOne: mock.fn(async () => ({ id: 'co-c', onboardingStatus: 'not_started' })),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store
  await createUser(store, admin, { email: 'new@x', fullName: 'New User', role: 'customer_user', companyId: 'co-c' })
  await new Promise((resolve) => setImmediate(resolve)) // flush the fire-and-forget sends
  const adminMails = emails.filter((e) => /^Portal user created/.test(e.subject))
  assert.deepEqual(adminMails.map((e) => e.to).sort(), ['boss@sigenic.com', 'mgr@sigenic.com'])
})

test('user.createUser — internal admin must pick a target company (no silent fallback to own org)', async () => {
  // Without this guard, an inviter from Sigenic forgetting to pick a company
  // would silently attach the new user to Sigenic; an inviter who is actually a
  // distributor admin (impossible here) would attach to their distributor org.
  // The fallback is only safe for external company admins managing their OWN org.
  const store = {
    createUser: mock.fn(async () => ({ id: 'u-x', email: 'who@x', fullName: 'Who', role: 'customer_user' })),
    appendAudit: mock.fn(async () => {}),
  } as unknown as Store
  await assert.rejects(
    () => createUser(store, superAdmin, { email: 'who@x', fullName: 'Who', role: 'customer_user' }),
    /pick a company/i,
  )
  assert.equal((store.createUser as any).mock.callCount(), 0, 'no row written when target company is missing')
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
  await new Promise((resolve) => setImmediate(resolve)) // flush the fire-and-forget sends
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
