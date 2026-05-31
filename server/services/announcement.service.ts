import { sendEmail, announcementEmail } from '../infra/email'
import { can, audienceMatches } from '../../shared/permissions'
import { badRequest, forbidden } from '../http/errors'
import { audit } from './audit'
import { uid, nowIso } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

/**
 * Create an announcement, then fan out to in-app notifications + email for the
 * matching audience. The audience filtering lives here (service layer) rather
 * than in the data layer, so the repository stays free of permission logic.
 */
export async function createAnnouncement(store: Store, auth: AuthPayload, announcement: any): Promise<{ item: any; recipients: number }> {
  if (!can(auth, 'manage_announcements')) throw forbidden()
  if (!announcement?.title || !announcement?.body) throw badRequest('Title and body are required.')
  const created = await store.insert('announcements', {
    id: uid('ann'),
    title: announcement.title,
    body: announcement.body,
    audience_type: announcement.audienceType ?? 'all',
    pinned: Boolean(announcement.pinned),
    created_by: auth.sub,
    publish_at: announcement.publishAt ?? nowIso(),
    expire_at: announcement.expireAt ?? null,
  })
  await audit(store, auth, 'announcement', created.id, 'create', null, { audience: created.audienceType })

  const allUsers = await store.list('users', { order: 'created_at DESC' })
  const targets = allUsers.filter((u: any) => audienceMatches(u, created.audienceType))
  // In-app notification + email per target are independent — fan them all out concurrently.
  await Promise.all(
    targets.flatMap((u: any) => [
      store
        .insert('notifications', {
          id: `ntf-${u.id}-${created.id}`.slice(0, 60),
          user_id: u.id,
          company_id: u.companyId,
          kind: 'announcement',
          title: created.title,
          body: created.body,
          link: '/app',
        })
        .catch(() => {}),
      sendEmail(store, { to: u.email, ...announcementEmail({ title: created.title, body: created.body, author: auth.name }) }).catch(() => {}),
    ]),
  )
  return { item: created, recipients: targets.length }
}

export async function updateAnnouncement(store: Store, auth: AuthPayload, id: string, item: any): Promise<any> {
  if (!can(auth, 'manage_announcements')) throw forbidden()
  return store.update('announcements', id, item ?? {})
}

export async function deleteAnnouncement(store: Store, auth: AuthPayload, id: string): Promise<void> {
  if (!can(auth, 'manage_announcements')) throw forbidden()
  await store.remove('announcements', id)
  await audit(store, auth, 'announcement', id, 'delete', null, null)
}
