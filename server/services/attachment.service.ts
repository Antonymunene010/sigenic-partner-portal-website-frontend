/**
 * Binary attachments for article bodies (knowledge base + success stories).
 * Images and files uploaded from the rich-text editor are stored as bytea rows in
 * article_assets and served back from a stable /api/attachments/:id URL, which the
 * editor embeds into the markdown body. Mirrors the portal's "everything in
 * Postgres" stance — no object store or local-disk dependency.
 */
import { can } from '../../shared/permissions'
import { badRequest, forbidden, notFound } from '../http/errors'
import { uid } from '../util/ids'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

/** 25 MB ceiling, matched by the express.raw limit on the upload route. */
const MAX_BYTES = 25 * 1024 * 1024

export interface UploadedAsset {
  id: string
  url: string
  filename: string
  mimeType: string
  sizeBytes: number
}

/** Anyone who can author knowledge or success-story content may upload assets. */
function canUpload(auth: AuthPayload): boolean {
  return can(auth, 'manage_knowledge') || can(auth, 'manage_success_stories')
}

export async function createAttachment(
  store: Store,
  auth: AuthPayload,
  data: Buffer,
  meta: { filename: string; mimeType: string },
): Promise<UploadedAsset> {
  if (!canUpload(auth)) throw forbidden()
  if (!data || data.length === 0) throw badRequest('Empty upload.')
  if (data.length > MAX_BYTES) throw badRequest('File too large (max 25 MB).')

  const id = uid('asset')
  const filename = (meta.filename || 'upload').slice(0, 200)
  const mimeType = meta.mimeType || 'application/octet-stream'
  await store.insertAttachment({ id, filename, mimeType, sizeBytes: data.length, data, createdBy: auth.sub })
  return { id, url: `/api/attachments/${id}`, filename, mimeType, sizeBytes: data.length }
}

export async function getAttachment(
  store: Store,
  id: string,
): Promise<{ filename: string; mimeType: string; data: Buffer }> {
  const asset = await store.getAttachment(id)
  if (!asset) throw notFound('Attachment not found.')
  return asset
}
