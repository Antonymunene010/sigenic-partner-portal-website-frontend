import type { Store } from '../db/store'

/**
 * Public (unauthenticated) marketing bundle: published+public success stories and
 * featured, audience=all knowledge articles. Visibility filtering lives here (service
 * layer), keeping the store free of business rules.
 */
export async function publicBundle(store: Store): Promise<{ successStories: any[]; knowledgeArticles: any[] }> {
  const [stories, articles] = await Promise.all([
    store.list('success_stories', { order: 'published_at DESC NULLS LAST' }),
    store.list('knowledge_articles', { order: 'updated_at DESC' }),
  ])
  return {
    successStories: stories.filter((s: any) => s.status === 'published' && s.visibility === 'public'),
    knowledgeArticles: articles.filter((a: any) => a.active && a.featured && a.audienceType === 'all'),
  }
}
