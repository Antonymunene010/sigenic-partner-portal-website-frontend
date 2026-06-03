import { useEffect, useState } from 'react'
import { getPublicBundle } from '../lib/api'
import { Spinner, useToast } from '../components/ui'
import { StoriesExplorer } from '../components/stories'
import type { SuccessStory } from '../lib/types'

export default function PublicStories() {
  const { push } = useToast()
  const [loading, setLoading] = useState(true)
  const [stories, setStories] = useState<SuccessStory[]>([])

  useEffect(() => {
    let active = true
    getPublicBundle()
      .then((bundle) => {
        if (active) setStories(bundle.successStories)
      })
      .catch((err: unknown) => {
        if (active) push(err instanceof Error ? err.message : 'Could not load success stories', 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [push])

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-8 py-10">
      <div className="max-w-2xl">
        <div className="eyebrow mb-2">Sigenic Care · Case studies</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Success <span className="text-emphasis">stories</span>
        </h1>
        <p className="mt-3 text-[15px] text-muted dark:text-muted-dark">
          How semiconductor partners cut scrap, lift yield and shorten excursion detection with Sigenic.
          Explore measurable outcomes from fabs and OSATs across the region.
        </p>
      </div>

      {loading ? <Spinner label="Loading success stories…" /> : <StoriesExplorer stories={stories} basePath="/stories" />}
    </div>
  )
}
