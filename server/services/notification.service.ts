import type { Store } from '../db/store'

export async function markNotificationRead(store: Store, id: string): Promise<void> {
  await store.update('notifications', id, { read: true })
}

export async function markAllNotificationsRead(store: Store, userId: string): Promise<void> {
  await store.markNotificationsRead(userId)
}
