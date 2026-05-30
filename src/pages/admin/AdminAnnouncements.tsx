import { useState } from 'react'
import { Pin, Trash2, Megaphone } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { publishAnnouncement, deleteAnnouncement } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Card, EmptyState, Field, Spinner, useToast } from '../../components/ui'
import { Badge } from '../../components/Badge'
import { AUDIENCE_TYPES, AUDIENCE_LABEL, AUDIENCE_TONE } from '../../lib/constants'
import { fmtRelative } from '../../lib/format'
import type { AudienceType } from '../../lib/types'

interface FormState {
  title: string
  body: string
  audienceType: AudienceType
  pinned: boolean
}

const EMPTY_FORM: FormState = { title: '', body: '', audienceType: 'all', pinned: false }

export default function AdminAnnouncements() {
  const { user } = useAuth()
  const { announcements, ready, refresh } = useData()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const canManage = can(user, 'manage_announcements')

  if (!ready) return <Spinner />

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.publishAt.localeCompare(a.publishAt)
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) {
      toast.push('Title and body are required.', 'error')
      return
    }
    setBusy(true)
    try {
      const { recipients } = await publishAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        audienceType: form.audienceType,
        pinned: form.pinned,
      })
      await refresh()
      setForm(EMPTY_FORM)
      toast.push(`Published to ${recipients} recipient${recipients === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Publish failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await deleteAnnouncement(id)
      await refresh()
      toast.push('Announcement deleted.')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Comms"
        title="Announcements"
        description="Broadcast updates to partners and internal teams. Pin the important ones to the top of their dashboard."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
        {canManage && (
          <Card title="Publish announcement" eyebrow="New">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Title" htmlFor="ann-title">
                <input
                  id="ann-title"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Q3 platform maintenance window"
                />
              </Field>
              <Field label="Body" htmlFor="ann-body">
                <textarea
                  id="ann-body"
                  className="textarea"
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="What partners need to know…"
                />
              </Field>
              <Field label="Audience" htmlFor="ann-audience">
                <select
                  id="ann-audience"
                  className="select"
                  value={form.audienceType}
                  onChange={(e) => setForm((f) => ({ ...f, audienceType: e.target.value as AudienceType }))}
                >
                  {AUDIENCE_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                />
                Pin to top
              </label>
              <div>
                <button type="submit" className="btn btn-accent" disabled={busy}>
                  {busy ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </form>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {sorted.length === 0 ? (
            <Card padded={false}>
              <EmptyState
                icon={<Megaphone size={24} />}
                title="No announcements yet"
                hint={canManage ? 'Publish your first announcement using the form.' : 'Check back later for updates.'}
              />
            </Card>
          ) : (
            sorted.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {a.pinned && (
                        <Badge tone="accent" dot>
                          <Pin size={11} /> Pinned
                        </Badge>
                      )}
                      <Badge tone={AUDIENCE_TONE[a.audienceType]}>{AUDIENCE_LABEL[a.audienceType]}</Badge>
                      <span className="text-xs text-faint dark:text-faint-dark">{fmtRelative(a.publishAt)}</span>
                    </div>
                    <h3 className="text-[15px] font-semibold tracking-tight">{a.title}</h3>
                    <p className="mt-1 text-sm text-muted dark:text-muted-dark leading-relaxed whitespace-pre-line">
                      {a.body}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      className="btn btn-ghost text-xs shrink-0"
                      onClick={() => remove(a.id)}
                      disabled={busy}
                      aria-label="Delete announcement"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
