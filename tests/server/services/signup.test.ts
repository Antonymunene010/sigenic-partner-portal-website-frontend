import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { signup, approveSignup, rejectSignup } from '../../../server/services/signup.service'
import { hashPassword } from '../../../server/infra/auth'
import { canApproveSignup, canSeePendingSignup } from '../../../shared/permissions'
import type { Store } from '../../../server/db/store'
import type { AuthPayload } from '../../../server/infra/auth'

/** A minimal store stub seeded with fixed companies — extends with whatever the test exercises. */
function makeStore(opts: {
  companies?: Record<string, any>
  duplicateEmail?: boolean
  users?: Record<string, any>
} = {}): { store: Store; emails: any[]; createdUsers: any[]; createdCompanies: any[]; updates: any[] } {
  const companies = { ...(opts.companies ?? {}) }
  const users = { ...(opts.users ?? {}) }
  const emails: any[] = []
  const createdUsers: any[] = []
  const createdCompanies: any[] = []
  const updates: any[] = []

  const store = {
    getOne: mock.fn(async (table: string, id: string) => {
      if (table === 'companies') return companies[id] ?? null
      if (table === 'users') return users[id] ?? null
      return null
    }),
    insert: mock.fn(async (table: string, data: any) => {
      const row = { ...data, companyName: data.company_name, companyType: data.company_type }
      if (table === 'companies') {
        companies[row.id] = row
        createdCompanies.push(row)
      }
      return row
    }),
    createUser: mock.fn(async (data: any) => {
      // Mirror the real store: a duplicate email rejects with this exact message.
      if (opts.duplicateEmail) throw new Error('A user with that email already exists.')
      const row = { ...data, fullName: data.full_name, companyId: data.company_id, userType: data.user_type }
      users[data.id] = row
      createdUsers.push(row)
      return row
    }),
    update: mock.fn(async (table: string, id: string, patch: any) => {
      updates.push({ table, id, patch })
      if (table === 'users' && users[id]) users[id] = { ...users[id], ...patch }
      return users[id]
    }),
    // getUserById JOINs companies → carries companyName, like the real store.
    getUserById: mock.fn(async (id: string) => {
      const u = users[id]
      if (!u) return null
      return { ...u, companyName: companies[u.companyId]?.companyName }
    }),
    getUserAuthById: mock.fn(async (id: string) => {
      const u = users[id]
      if (!u) return null
      return { ...u, passwordHash: u.password_hash ?? hashPassword('random'), companyName: companies[u.companyId]?.companyName }
    }),
    list: mock.fn(async () => []),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
    appendAudit: mock.fn(async () => {}),
  } as unknown as Store

  return { store, emails, createdUsers, createdCompanies, updates }
}

const COMPANY_ACME: any = { id: 'co-acme', companyName: 'Acme', companyType: 'customer', status: 'active' }
const COMPANY_SIGENIC: any = { id: 'co-sig', companyName: 'Sigenic', companyType: 'sigenic', status: 'active' }

/* ---------- signup ---------- */

test('signup — joining an existing company creates a pending customer_user', async () => {
  const { store, createdUsers, createdCompanies, emails } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME } })
  await signup(store, { fullName: 'Jane', email: 'jane@acme.com', companyId: COMPANY_ACME.id })

  assert.equal(createdCompanies.length, 0, 'must not create a new company')
  assert.equal(createdUsers.length, 1)
  assert.equal(createdUsers[0].status, 'pending')
  assert.equal(createdUsers[0].role, 'customer_user')
  assert.equal(createdUsers[0].company_id, COMPANY_ACME.id)
  // Receipt to the registrant, no set-password link until approval.
  assert.ok(emails.some((e) => e.to === 'jane@acme.com'))
  assert.ok(!emails.some((e) => /reset-password\?token=/.test(e.text ?? '')))
})

test('signup — new-company request creates a pending_invite company AND a pending customer_admin', async () => {
  const { store, createdUsers, createdCompanies } = makeStore()
  await signup(store, {
    fullName: 'Mei',
    email: 'mei@new.co',
    newCompany: { companyName: 'NewCo', companyType: 'customer', country: 'SG' },
  })

  assert.equal(createdCompanies.length, 1)
  assert.equal(createdCompanies[0].status, 'pending_invite')
  assert.equal(createdCompanies[0].company_name, 'NewCo')
  assert.equal(createdUsers.length, 1)
  // First member of a new company is its primary admin.
  assert.equal(createdUsers[0].role, 'customer_admin')
  assert.equal(createdUsers[0].status, 'pending')
})

test('signup — new-company distributor request maps to distributor_admin', async () => {
  const { store, createdUsers } = makeStore()
  await signup(store, {
    fullName: 'Leo',
    email: 'leo@dist.co',
    newCompany: { companyName: 'DistCo', companyType: 'distributor' },
  })
  assert.equal(createdUsers[0].role, 'distributor_admin')
})

test('signup — rejects a duplicate email (createUser throws, surfaces as 400)', async () => {
  const { store } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, duplicateEmail: true })
  await assert.rejects(() => signup(store, { fullName: 'Jane', email: 'taken@x.io', companyId: COMPANY_ACME.id }), /already exists/)
})

test('signup — rejects joining the Sigenic internal company', async () => {
  const { store } = makeStore({ companies: { [COMPANY_SIGENIC.id]: COMPANY_SIGENIC } })
  await assert.rejects(() => signup(store, { fullName: 'Eve', email: 'e@s.io', companyId: COMPANY_SIGENIC.id }), /not available to join/)
})

test('signup — rejects joining an inactive/archived company', async () => {
  const archived = { id: 'co-old', companyName: 'Old', companyType: 'customer', status: 'archived' }
  const { store } = makeStore({ companies: { [archived.id]: archived } })
  await assert.rejects(() => signup(store, { fullName: 'X', email: 'x@old.io', companyId: archived.id }), /not available to join/)
})

test('signup — needs name and email', async () => {
  const { store } = makeStore()
  await assert.rejects(() => signup(store, { fullName: '', email: 'a@b.c', companyId: 'co-1' }), /Name and email/)
  await assert.rejects(() => signup(store, { fullName: 'X', email: '', companyId: 'co-1' }), /Name and email/)
})

test('signup — needs either companyId OR newCompany, not both, not neither', async () => {
  const { store } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME } })
  await assert.rejects(() => signup(store, { fullName: 'X', email: 'x@y.io' } as any), /My company is not listed/)
  await assert.rejects(
    () => signup(store, { fullName: 'X', email: 'x@y.io', companyId: COMPANY_ACME.id, newCompany: { companyName: 'N', companyType: 'customer' } } as any),
    /either an existing company or a new company/,
  )
})

test('signup — rejects an invalid email format before touching the store', async () => {
  const { store } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME } })
  await assert.rejects(() => signup(store, { fullName: 'X', email: 'not-an-email', companyId: COMPANY_ACME.id }), /valid email/)
  // Format check runs ahead of any persistence — no company lookup, no user write.
  assert.equal((store.getOne as any).mock.callCount(), 0)
  assert.equal((store.createUser as any).mock.callCount(), 0)
})

/* ---------- approveSignup ---------- */

const ACME_ADMIN: AuthPayload = {
  sub: 'u-admin', name: 'Acme Admin', email: 'admin@acme.com',
  role: 'customer_admin', userType: 'customer', companyId: COMPANY_ACME.id, companyType: 'customer',
}
const SIGENIC_SUPER: AuthPayload = {
  sub: 'u-sup', name: 'Super', email: 's@sig.com',
  role: 'super_admin', userType: 'internal', companyId: COMPANY_SIGENIC.id, companyType: 'sigenic',
}
const SIGENIC_ADMIN: AuthPayload = {
  sub: 'u-sa', name: 'Sigenic Admin', email: 'a@sig.com',
  role: 'admin', userType: 'internal', companyId: COMPANY_SIGENIC.id, companyType: 'sigenic',
}

test('approveSignup — company admin flips the pending user to invited and triggers the invite email', async () => {
  const pendingUser = { id: 'u-p1', fullName: 'P', email: 'p@acme.com', role: 'customer_user', status: 'pending', companyId: COMPANY_ACME.id, userType: 'customer' }
  const { store, updates, emails } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, users: { [pendingUser.id]: pendingUser } })

  await approveSignup(store, ACME_ADMIN, pendingUser.id)
  const flip = updates.find((u) => u.table === 'users' && u.id === pendingUser.id)
  assert.equal(flip.patch.status, 'invited')
  assert.equal(flip.patch.role, 'customer_user')
  // Set-password link is emailed.
  assert.ok(emails.some((e) => e.to === 'p@acme.com' && /reset-password\?token=/.test(e.text ?? '')))
})

test('approveSignup — Sigenic admin can approve a new-company primary admin (canManageUser allows it)', async () => {
  const newCo: any = { id: 'co-new', companyName: 'NewCo', companyType: 'customer', status: 'pending_invite' }
  const pendingUser = { id: 'u-new', fullName: 'M', email: 'm@new.co', role: 'customer_admin', status: 'pending', companyId: newCo.id, userType: 'customer' }
  const { store, updates } = makeStore({ companies: { [newCo.id]: newCo }, users: { [pendingUser.id]: pendingUser } })

  await approveSignup(store, SIGENIC_ADMIN, pendingUser.id)
  assert.ok(updates.some((u) => u.table === 'users' && u.patch.status === 'invited'))
})

test('approveSignup — an unrelated company admin cannot approve another company\'s pending user', async () => {
  const otherCo: any = { id: 'co-other', companyName: 'Other', companyType: 'customer', status: 'active' }
  const pendingUser = { id: 'u-p3', fullName: 'P', email: 'p@other.co', role: 'customer_user', status: 'pending', companyId: otherCo.id, userType: 'customer' }
  const { store } = makeStore({ companies: { [otherCo.id]: otherCo }, users: { [pendingUser.id]: pendingUser } })

  await assert.rejects(() => approveSignup(store, ACME_ADMIN, pendingUser.id), /cannot approve/)
})

test('approveSignup — a company admin cannot approve a *new-company* request (canManageUser denies outside-company scope)', async () => {
  const newCo: any = { id: 'co-new', companyName: 'NewCo', companyType: 'customer', status: 'pending_invite' }
  const pendingUser = { id: 'u-new', fullName: 'M', email: 'm@new.co', role: 'customer_admin', status: 'pending', companyId: newCo.id, userType: 'customer' }
  const { store } = makeStore({ companies: { [newCo.id]: newCo }, users: { [pendingUser.id]: pendingUser } })

  // ACME_ADMIN scopes to co-acme, not co-new — must be refused even though the role is in their assignable set.
  await assert.rejects(() => approveSignup(store, ACME_ADMIN, pendingUser.id), /cannot approve/)
})

test('approveSignup — a user that is no longer pending throws (already reviewed)', async () => {
  const activeUser = { id: 'u-a', fullName: 'A', email: 'a@acme.com', role: 'customer_user', status: 'active', companyId: COMPANY_ACME.id, userType: 'customer' }
  const { store } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, users: { [activeUser.id]: activeUser } })
  await assert.rejects(() => approveSignup(store, ACME_ADMIN, activeUser.id), /already been reviewed/)
})

test('approveSignup — an unknown user id 404s', async () => {
  const { store } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME } })
  await assert.rejects(() => approveSignup(store, ACME_ADMIN, 'u-nope'), /not found/)
})

test('approveSignup — approver may override the granted role', async () => {
  const pendingUser = { id: 'u-p4', fullName: 'P', email: 'p@acme.com', role: 'customer_user', status: 'pending', companyId: COMPANY_ACME.id, userType: 'customer' }
  const { store, updates } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, users: { [pendingUser.id]: pendingUser } })

  await approveSignup(store, ACME_ADMIN, pendingUser.id, { role: 'customer_admin' })
  const flip = updates.find((u) => u.table === 'users' && u.id === pendingUser.id)
  assert.equal(flip.patch.role, 'customer_admin')
})

/* ---------- rejectSignup ---------- */

test('rejectSignup — flips to rejected and emails the user', async () => {
  const pendingUser = { id: 'u-p5', fullName: 'P', email: 'p@acme.com', role: 'customer_user', status: 'pending', companyId: COMPANY_ACME.id, userType: 'customer' }
  const { store, updates, emails } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, users: { [pendingUser.id]: pendingUser } })

  await rejectSignup(store, ACME_ADMIN, pendingUser.id, 'duplicate request')
  const flip = updates.find((u) => u.table === 'users' && u.id === pendingUser.id)
  assert.equal(flip.patch.status, 'rejected')
  const note = emails.find((e) => e.to === 'p@acme.com')
  assert.ok(note, 'user must be notified')
  assert.match(note.text, /not approved/i)
  assert.match(note.text, /duplicate request/)
})

test('rejectSignup — out-of-scope approver is refused', async () => {
  const otherCo: any = { id: 'co-other', companyName: 'Other', companyType: 'customer', status: 'active' }
  const pendingUser = { id: 'u-p6', fullName: 'P', email: 'p@other.co', role: 'customer_user', status: 'pending', companyId: otherCo.id, userType: 'customer' }
  const { store } = makeStore({ companies: { [otherCo.id]: otherCo }, users: { [pendingUser.id]: pendingUser } })
  await assert.rejects(() => rejectSignup(store, ACME_ADMIN, pendingUser.id), /cannot reject/)
})

test('rejectSignup — Sigenic super_admin can reject anyone', async () => {
  const pendingUser = { id: 'u-p7', fullName: 'P', email: 'p@acme.com', role: 'customer_user', status: 'pending', companyId: COMPANY_ACME.id, userType: 'customer' }
  const { store, updates } = makeStore({ companies: { [COMPANY_ACME.id]: COMPANY_ACME }, users: { [pendingUser.id]: pendingUser } })
  await rejectSignup(store, SIGENIC_SUPER, pendingUser.id)
  assert.ok(updates.some((u) => u.patch.status === 'rejected'))
})

/* ---------- permissions helpers ---------- */

test('canApproveSignup — mirrors canManageUser routing', () => {
  // Same-company admin: yes for their own org-type role; out-of-company: no.
  assert.equal(canApproveSignup(ACME_ADMIN, COMPANY_ACME.id, 'customer_user'), true)
  assert.equal(canApproveSignup(ACME_ADMIN, 'co-other', 'customer_user'), false)
  // Sigenic admin: yes for external, no for internal staff.
  assert.equal(canApproveSignup(SIGENIC_ADMIN, COMPANY_ACME.id, 'customer_admin'), true)
  assert.equal(canApproveSignup(SIGENIC_ADMIN, COMPANY_SIGENIC.id, 'admin'), false)
  // super_admin: yes to everything.
  assert.equal(canApproveSignup(SIGENIC_SUPER, COMPANY_SIGENIC.id, 'admin'), true)
})

test('canSeePendingSignup — internal sees all; company admin only own; plain user nothing', () => {
  assert.equal(canSeePendingSignup(SIGENIC_SUPER, 'any'), true)
  assert.equal(canSeePendingSignup(SIGENIC_ADMIN, 'any'), true)
  assert.equal(canSeePendingSignup(ACME_ADMIN, COMPANY_ACME.id), true)
  assert.equal(canSeePendingSignup(ACME_ADMIN, 'co-other'), false)
  const PLAIN: AuthPayload = { ...ACME_ADMIN, role: 'customer_user' }
  assert.equal(canSeePendingSignup(PLAIN, COMPANY_ACME.id), false)
})
