import { useParams } from 'react-router-dom'
import { useData } from '../lib/data'
import { Spinner } from '../components/ui'
import { StoryArticle, StoryNotFound, publishedStories } from '../components/stories'

export default function StoryView() {
  const { slug } = useParams()
  const { successStories, ready } = useData()

  if (!ready) return <Spinner label="Loading story…" />

  const published = publishedStories(successStories)
  const story = published.find((s) => s.slug === slug)

  if (!story) return <StoryNotFound basePath="/app/stories" />

  return (
    <div className="max-w-3xl mx-auto">
      <StoryArticle story={story} stories={published} basePath="/app/stories" />
    </div>
  )
}
