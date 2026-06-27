import { sendEmail, announcementEmail } from '../infra/email'
import { can, audienceMatches } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
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
  // Render the email template once (one round-trip to email_templates), then fan
  // notifications + emails out concurrently.
  const announcementMsg = await announcementEmail(store, { title: created.title, body: created.body, author: auth.name })
  await Promise.all(
    targets.flatMap((u: any) => [
      store
        .appendNotification({
          id: `ntf-${u.id}-${created.id}`.slice(0, 60),
          userId: u.id,
          companyId: u.companyId,
          kind: 'announcement',
          title: created.title,
          body: created.body,
          link: '/app',
        })
        .catch(() => {}),
      sendEmail(store, { to: u.email, ...announcementMsg }).catch(() => {}),
    ]),
  )
  return { item: created, recipients: targets.length }
}

export async function updateAnnouncement(store: Store, auth: AuthPayload, id: string, item: any): Promise<any> {
  if (!can(auth, 'manage_announcements')) throw forbidden()
  const before = await store.getOne('announcements', id)
  if (!before) throw notFound('Not found.')
  const updated = await store.update('announcements', id, item ?? {})
  await audit(store, auth, 'announcement', id, 'update', before, updated)
  return updated
}

export async function deleteAnnouncement(store: Store, auth: AuthPayload, id: string): Promise<void> {
  if (!can(auth, 'manage_announcements')) throw forbidden()
  const before = await store.getOne('announcements', id)
  await store.remove('announcements', id)
  await audit(store, auth, 'announcement', id, 'delete', before, null)
}
