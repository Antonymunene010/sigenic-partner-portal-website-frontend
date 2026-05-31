import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { AUDIENCE_TYPES, KB_CATEGORIES, boolTone } from '../../lib/constants'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { useToast } from '../../components/ui'
import { syncKnowledge } from '../../lib/api'
import type { KnowledgeArticle } from '../../lib/types'

const SOURCE_TONE = { portal: 'neutral', notion: 'accent', zendesk: 'info' } as const

export default function AdminKnowledge() {
  const { user } = useAuth()
  const { knowledgeArticles, refresh } = useData()
  const { push } = useToast()
  const canManage = can(user, 'manage_knowledge')
  const [syncing, setSyncing] = useState(false)

  const categoryOptions = KB_CATEGORIES.map((c) => ({ value: c, label: c }))

  async function handleSync() {
    setSyncing(true)
    try {
      const { synced, mode } = await syncKnowledge()
      if (mode === 'mock') {
        push('Notion is not configured — set NOTION_TOKEN and NOTION_KB_DATABASE_ID to enable sync.', 'error')
      } else {
        await refresh()
        push(synced > 0 ? `Synced ${synced} article${synced === 1 ? '' : 's'} from Notion.` : 'Already up to date.', 'success')
      }
    } catch (e) {
      push(e instanceof Error ? e.message : 'Sync failed.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge base management"
        description="Govern the internal knowledge base — categorise articles, target audiences and control what surfaces in the portal. Content can be authored in the portal or synced from Notion."
        actions={
          canManage ? (
            <button onClick={handleSync} disabled={syncing} className="btn-outline">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync from Notion'}
            </button>
          ) : undefined
        }
      />

      <CrudResource<KnowledgeArticle>
        title="Articles"
        resource="knowledge-articles"
        idPrefix="kb"
        canManage={canManage}
        wide
        inlineToggle={{ key: 'active' }}
        rows={knowledgeArticles}
        refresh={refresh}
        columns={[
          { key: 'title', header: 'Title', render: (a) => <span className="font-medium">{a.title}</span> },
          { key: 'category', header: 'Category', render: (a) => <span className="text-muted dark:text-muted-dark">{a.category}</span> },
          { key: 'source', header: 'Source', sortAccessor: (a) => a.sourceType, render: (a) => <Badge tone={SOURCE_TONE[a.sourceType] ?? 'neutral'}>{a.sourceType}</Badge> },
          { key: 'audienceType', header: 'Audience', render: (a) => <span className="capitalize text-muted dark:text-muted-dark">{a.audienceType}</span> },
          { key: 'featured', header: 'Featured', render: (a) => (a.featured ? <Badge tone="accent">featured</Badge> : <span className="text-faint">—</span>) },
          { key: 'active', header: 'Status', render: (a) => <Badge tone={boolTone(a.active)}>{a.active ? 'active' : 'inactive'}</Badge> },
        ]}
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'slug', label: 'Slug', placeholder: 'auto-generated if blank' },
          { key: 'summary', label: 'Summary', type: 'textarea' },
          { key: 'category', label: 'Category', type: 'select', options: categoryOptions },
          { key: 'body', label: 'Body', type: 'textarea', full: true },
          { key: 'audienceType', label: 'Audience', type: 'select', options: AUDIENCE_TYPES, defaultValue: 'all' },
          { key: 'featured', label: 'Featured', type: 'checkbox', placeholder: 'Feature this article' },
          { key: 'active', label: 'Active', type: 'checkbox', defaultValue: true },
        ]}
      />
    </div>
  )
}
