import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { requestPasswordReset, resetPasswordWithToken } from '../../../server/services/auth.service'
import { hashPassword, signResetToken } from '../../../server/infra/auth'
import type { Store } from '../../../server/db/store'

const APP_URL = 'https://portal.example'

test('requestPasswordReset — active account gets a single-use reset link emailed', async () => {
  const emails: any[] = []
  const account = { id: 'u-9', email: 'pat@x.io', fullName: 'Pat', status: 'active', passwordHash: hashPassword('old') }
  const store = {
    getUserAuthByEmail: mock.fn(async () => account),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store

  await requestPasswordReset(store, 'pat@x.io', APP_URL)
  assert.equal(emails.length, 1)
  assert.equal(emails[0].to, 'pat@x.io')
  assert.match(emails[0].text, /\/reset-password\?token=/)
})

test('requestPasswordReset — unknown email is a silent no-op (no account enumeration)', async () => {
  const emails: any[] = []
  const store = {
    getUserAuthByEmail: mock.fn(async () => null),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store

  await requestPasswordReset(store, 'nobody@x.io', APP_URL) // resolves, does not throw
  assert.equal(emails.length, 0)
})

test('requestPasswordReset — deactivated account receives nothing', async () => {
  const emails: any[] = []
  const account = { id: 'u-9', email: 'pat@x.io', fullName: 'Pat', status: 'inactive', passwordHash: hashPassword('old') }
  const store = {
    getUserAuthByEmail: mock.fn(async () => account),
    appendEmail: mock.fn(async (rec: any) => { emails.push(rec) }),
  } as unknown as Store

  await requestPasswordReset(store, 'pat@x.io', APP_URL)
  assert.equal(emails.length, 0)
})

test('resetPasswordWithToken — a valid token sets the new password', async () => {
  const account = { id: 'u-9', email: 'pat@x.io', fullName: 'Pat', status: 'active', passwordHash: hashPassword('old') }
  let saved: any = null
  const store = {
    getUserAuthById: mock.fn(async () => account),
    setPassword: mock.fn(async (id: string, password: string) => { saved = { id, password } }),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store

  const token = signResetToken(account.id, account.passwordHash)
  await resetPasswordWithToken(store, token, 'newsecret')
  assert.deepEqual(saved, { id: 'u-9', password: 'newsecret' })
})

test('resetPasswordWithToken — an invited user is activated on first password set', async () => {
  const account = { id: 'u-inv', email: 'new@x.io', fullName: 'New', status: 'invited', passwordHash: hashPassword('temp') }
  const updates: any[] = []
  const store = {
    getUserAuthById: mock.fn(async () => account),
    setPassword: mock.fn(async () => {}),
    update: mock.fn(async (table: string, id: string, data: any) => { updates.push({ table, id, data }) }),
    appendEmail: mock.fn(async () => {}),
  } as unknown as Store

  const token = signResetToken(account.id, account.passwordHash)
  await resetPasswordWithToken(store, token, 'newsecret')
  assert.deepEqual(updates, [{ table: 'users', id: 'u-inv', data: { status: 'active' } }])
})

test('resetPasswordWithToken — a forged/garbage token is rejected', async () => {
  const store = {
    getUserAuthById: mock.fn(),
    setPassword: mock.fn(),
    appendEmail: mock.fn(),
  } as unknown as Store

  await assert.rejects(() => resetPasswordWithToken(store, 'not.a.real.token', 'newsecret'), /invalid or has expired/)
  assert.equal((store.setPassword as any).mock.callCount(), 0)
})

test('resetPasswordWithToken — the link is single-use (fingerprint no longer matches once the password changed)', async () => {
  const oldHash = hashPassword('old')
  // By the time the stale link is replayed, the stored hash is already different.
  const account = { id: 'u-9', email: 'pat@x.io', fullName: 'Pat', status: 'active', passwordHash: hashPassword('already-changed') }
  const store = {
    getUserAuthById: mock.fn(async () => account),
    setPassword: mock.fn(),
    appendEmail: mock.fn(),
  } as unknown as Store

  const staleToken = signResetToken(account.id, oldHash)
  await assert.rejects(() => resetPasswordWithToken(store, staleToken, 'newsecret'), /already been used/)
  assert.equal((store.setPassword as any).mock.callCount(), 0)
})

test('resetPasswordWithToken — rejects too-short passwords before touching the store', async () => {
  const store = { getUserAuthById: mock.fn(), setPassword: mock.fn(), appendEmail: mock.fn() } as unknown as Store
  await assert.rejects(() => resetPasswordWithToken(store, 'x.y', '12'), /at least 4/)
  assert.equal((store.getUserAuthById as any).mock.callCount(), 0)
})
