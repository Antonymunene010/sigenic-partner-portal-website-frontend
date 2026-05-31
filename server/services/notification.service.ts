import { notFound } from '../http/errors'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

export async function markNotificationRead(store: Store, auth: AuthPayload, id: string): Promise<void> {
  // 404 rather than 403 so a non-owner can't probe which notification IDs exist.
  if (!(await store.markNotificationRead(id, auth.sub))) throw notFound()
}

export async function markAllNotificationsRead(store: Store, userId: string): Promise<void> {
  await store.markNotificationsRead(userId)
}
