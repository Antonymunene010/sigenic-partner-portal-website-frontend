import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { PageHeader } from '../../components/PageHeader'
import { CrudResource } from '../../components/CrudResource'
import { Badge } from '../../components/Badge'
import { VISIBILITY_LABEL, VISIBILITY_OPTIONS } from '../../lib/constants'
import type { SuccessStory } from '../../lib/types'

export default function AdminStories() {
  const { user } = useAuth()
  const { successStories, refresh } = useData()
  const canManage = can(user, 'manage_success_stories')

  return (
    <div>
      <PageHeader
        eyebrow="Case studies"
        title="Success stories"
        description="Curate partner case studies — control publication status, featuring, and who can see each story. Internal management only."
      />

      <CrudResource<SuccessStory>
        title="Success stories"
        resource="success-stories"
        idPrefix="story"
        canManage={canManage}
        wide
        inlineToggle={{ key: 'status', onValue: 'published', offValue: 'draft', activateLabel: 'Publish', deactivateLabel: 'Unpublish' }}
        rows={successStories}
        refresh={refresh}
        columns={[
          { key: 'title', header: 'Title', render: (s) => <span className="font-medium">{s.title}</span> },
          { key: 'partner', header: 'Partner', render: (s) => <span className="text-muted dark:text-muted-dark">{s.partner}</span> },
          { key: 'industry', header: 'Industry', render: (s) => <span className="text-muted dark:text-muted-dark">{s.industry}</span> },
          {
            key: 'status',
            header: 'Status',
            render: (s) => <Badge tone={s.status === 'published' ? 'success' : 'warn'}>{s.status}</Badge>,
          },
          {
            key: 'featured',
            header: 'Featured',
            render: (s) => (s.featured ? <Badge tone="accent">Featured</Badge> : <span className="text-faint">—</span>),
          },
          {
            key: 'visibility',
            header: 'Visibility',
            sortAccessor: (s) => VISIBILITY_LABEL[s.visibility] ?? s.visibility,
            render: (s) => <span className="text-muted dark:text-muted-dark">{VISIBILITY_LABEL[s.visibility]}</span>,
          },
        ]}
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'slug', label: 'Slug', required: true, placeholder: 'partner-yield-uplift' },
          { key: 'summary', label: 'Summary', type: 'textarea' },
          { key: 'partner', label: 'Partner' },
          { key: 'industry', label: 'Industry' },
          { key: 'region', label: 'Region' },
          { key: 'theme', label: 'Theme' },
          { key: 'body', label: 'Body', type: 'richtext', help: 'Drag, paste, or use the toolbar to add images and files.' },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            defaultValue: 'published',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ],
          },
          { key: 'featured', label: 'Featured', type: 'checkbox' },
          {
            key: 'visibility',
            label: 'Visibility',
            type: 'select',
            defaultValue: 'public',
            options: VISIBILITY_OPTIONS,
          },
        ]}
      />
    </div>
  )
}
