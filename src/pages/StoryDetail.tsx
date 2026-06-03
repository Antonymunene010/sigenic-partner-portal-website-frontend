import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicBundle } from '../lib/api'
import { Spinner } from '../components/ui'
import { StoryArticle, StoryNotFound } from '../components/stories'
import type { SuccessStory } from '../lib/types'

export default function StoryDetail() {
  const { slug } = useParams()
  const [stories, setStories] = useState<SuccessStory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getPublicBundle()
      .then((bundle) => {
        if (active) setStories(bundle.successStories)
      })
      .catch(() => {
        if (active) setStories([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) return <Spinner label="Loading story…" />

  const story = stories.find((s) => s.slug === slug)

  if (!story) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <StoryNotFound basePath="/stories" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <StoryArticle story={story} stories={stories} basePath="/stories" />
    </div>
  )
}
