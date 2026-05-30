import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { AUDIENCE_TYPES, KB_CATEGORIES, boolTone } from '../../lib/constants'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import type { KnowledgeArticle } from '../../lib/types'

export default function AdminKnowledge() {
  const { user } = useAuth()
  const { knowledgeArticles, refresh } = useData()
  const canManage = can(user, 'manage_knowledge')

  const categoryOptions = KB_CATEGORIES.map((c) => ({ value: c, label: c }))

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Knowledge base management"
        description="Govern the internal knowledge base — categorise articles, target audiences and control what surfaces in the portal."
      />

      <CrudResource<KnowledgeArticle>
        title="Articles"
        resource="knowledge-articles"
        idPrefix="kb"
        canManage={canManage}
        rows={knowledgeArticles}
        refresh={refresh}
        columns={[
          { key: 'title', header: 'Title', render: (a) => <span className="font-medium">{a.title}</span> },
          { key: 'category', header: 'Category', render: (a) => <span className="text-muted dark:text-muted-dark">{a.category}</span> },
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
