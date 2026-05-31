import { verifyPassword, signToken } from '../infra/auth'
import { badRequest, forbidden, notFound, unauthorized } from '../http/errors'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

export async function login(store: Store, email: string, password: string): Promise<{ user: any; token: string }> {
  if (!email || !password) throw badRequest('Email and password are required.')
  const account = await store.getUserAuthByEmail(String(email))
  if (!account) throw notFound('No account found for that email.')
  if (account.status === 'inactive') throw forbidden('This account is deactivated.')
  if (!verifyPassword(password, account.passwordHash)) throw unauthorized('Incorrect password.')
  await store.setLastLogin(account.id)
  const token = signToken({
    sub: account.id,
    role: account.role,
    userType: account.userType,
    companyId: account.companyId,
    companyType: account.companyType,
    email: account.email,
    name: account.fullName,
  })
  const user = await store.getUserById(account.id)
  return { user, token }
}

export async function changePassword(store: Store, auth: AuthPayload, currentPassword: string, newPassword: string): Promise<void> {
  if (!newPassword || String(newPassword).length < 4) throw badRequest('New password must be at least 4 characters.')
  const account = await store.getUserAuthByEmail(auth.email)
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) throw badRequest('Current password is incorrect.')
  await store.setPassword(account.id, newPassword)
}

export async function getMe(store: Store, auth: AuthPayload): Promise<any> {
  return store.getUserById(auth.sub)
}
