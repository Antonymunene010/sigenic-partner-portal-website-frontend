import { fetchNotionArticles, notionEnabled } from '../integration/notion'
import { can } from '../../shared/permissions'
import { forbidden } from '../http/errors'
import type { Store } from '../db/store'
import type { AuthPayload } from '../infra/auth'

/**
 * Pull Notion KB articles into the store (governance-preserving upsert). Used by
 * the background scheduler — no auth check here (the caller is trusted).
 */
export async function syncNotionArticles(store: Store): Promise<{ synced: number; mode?: string }> {
  if (!notionEnabled()) return { synced: 0, mode: 'mock' }
  const articles = await fetchNotionArticles()
  let synced = 0
  for (const article of articles) {
    try {
      await store.upsertNotionArticle(article)
      synced++
    } catch (error: any) {
      console.warn(`[notion:sync] ${article.sourceRefId}: ${error.message}`)
    }
  }
  return { synced }
}

/** Authenticated, permission-gated trigger for the Notion sync. */
export async function triggerNotionSync(store: Store, auth: AuthPayload): Promise<{ synced: number; mode?: string }> {
  if (!can(auth, 'manage_knowledge')) throw forbidden()
  return syncNotionArticles(store)
}
