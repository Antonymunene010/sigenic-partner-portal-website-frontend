import { useMemo } from 'react'
import { useData } from '../lib/data'
import { PageHeader } from '../components/PageHeader'
import { Spinner } from '../components/ui'
import { StoriesExplorer, publishedStories } from '../components/stories'

export default function Stories() {
  const { successStories, ready } = useData()
  // Memoized so the array identity is stable for StoriesExplorer's internal memos.
  // Visibility scope (public / partners / internal) is already applied by the server.
  const published = useMemo(() => publishedStories(successStories), [successStories])

  if (!ready) return <Spinner />

  return (
    <div>
      <PageHeader
        eyebrow="Case studies"
        title="Success stories"
        description="Real outcomes from semiconductor partners on Sigenic — measurable yield, scrap and downtime gains across fabs and OSATs."
      />
      <StoriesExplorer stories={published} basePath="/app/stories" />
    </div>
  )
}
