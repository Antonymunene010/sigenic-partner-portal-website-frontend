import { useMemo, useState, type ReactNode } from 'react'
import { Pin, PinOff, Archive, ArchiveRestore, Pencil, Plus, Megaphone, Search, Radio, Clock } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/data'
import { can } from '../../lib/permissions'
import { publishAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { DataTable, type Column } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { Badge } from '../../components/Badge'
import { StatCard, Field, Spinner, useToast, chipClass } from '../../components/ui'
import { AUDIENCE_TYPES, AUDIENCE_LABEL, AUDIENCE_TONE, type Tone } from '../../lib/constants'
import { fmtRelative } from '../../lib/format'
import type { Announcement, AudienceType } from '../../lib/types'

/** Lifecycle state, derived to mirror the partner-side filter in hydrate.service.ts. */
type StatusKey = 'live' | 'scheduled' | 'expired' | 'archived'

const STATUS_META: Record<StatusKey, { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  expired: { label: 'Expired', tone: 'warn' },
  archived: { label: 'Archived', tone: 'neutral' },
}

function announcementStatus(a: Announcement, now: number): StatusKey {
  if (!a.active) return 'archived'
  if (a.publishAt && new Date(a.publishAt).getTime() > now) return 'scheduled'
  if (a.expireAt && new Date(a.expireAt).getTime() < now) return 'expired'
  return 'live'
}

type Row = Announcement & { status: StatusKey }
type StatusFilter = 'all' | StatusKey | 'pinned'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
  { value: 'pinned', label: 'Pinned' },
]

const toggleBtnClass =
  'inline-flex items-center justify-center h-7 w-7 rounded-md border border-line dark:border-line-dark text-muted dark:text-muted-dark hover:bg-raised dark:hover:bg-raised-dark hover:text-ink dark:hover:text-ink-dark transition-colors disabled:opacity-50'

interface FormState {
  title: string
  body: string
  audienceType: AudienceType
  pinned: boolean
  expireOn: string // YYYY-MM-DD, '' = no expiry
}

const EMPTY_FORM: FormState = { title: '', body: '', audienceType: 'all', pinned: false, expireOn: '' }

export default function AdminAnnouncements() {
  const { user } = useAuth()
  const { announcements, ready, refresh } = useData()
  const toast = useToast()
  const canManage = can(user, 'manage_announcements')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [audience, setAudience] = useState<AudienceType | 'all'>('all')

  const [editing, setEditing] = useState<Announcement | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const stats = useMemo(() => {
    const now = Date.now()
    let live = 0
    let pinned = 0
    let expired = 0
    for (const a of announcements) {
      const s = announcementStatus(a, now)
      if (s === 'live') live++
      if (s === 'expired') expired++
      if (a.pinned) pinned++
    }
    return { total: announcements.length, live, pinned, expired }
  }, [announcements])

  const rows = useMemo<Row[]>(() => {
    const now = Date.now()
    const q = search.trim().toLowerCase()
    return announcements
      .map((a) => ({ ...a, status: announcementStatus(a, now) }))
      .filter((a) => {
        if (audience !== 'all' && a.audienceType !== audience) return false
        if (status === 'pinned') {
          if (!a.pinned) return false
        } else if (status !== 'all' && a.status !== status) {
          return false
        }
        if (q && !(a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))) return false
        return true
      })
  }, [announcements, search, status, audience])

  if (!ready) return <Spinner />

  const openNew = () => {
    setEditing(null)
    setCreating(true)
    setForm(EMPTY_FORM)
  }
  const openEdit = (a: Announcement) => {
    if (!canManage) return
    setEditing(a)
    setCreating(false)
    setForm({
      title: a.title,
      body: a.body,
      audienceType: a.audienceType,
      pinned: a.pinned,
      expireOn: a.expireAt ? a.expireAt.slice(0, 10) : '',
    })
  }
  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.push('Title and body are required.', 'error')
      return
    }
    setBusy(true)
    try {
      const expireAt = form.expireOn ? `${form.expireOn}T23:59:59` : null
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        audienceType: form.audienceType,
        pinned: form.pinned,
        expireAt,
      }
      if (creating) {
        const { recipients } = await publishAnnouncement(payload)
        toast.push(`Published to ${recipients} recipient${recipients === 1 ? '' : 's'}.`)
      } else if (editing) {
        await updateAnnouncement(editing.id, payload)
        toast.push('Saved.')
      }
      await refresh()
      close()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Save failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    if (!confirm('Delete this announcement? This cannot be undone.')) return
    setBusy(true)
    try {
      await deleteAnnouncement(editing.id)
      await refresh()
      toast.push('Announcement deleted.')
      close()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  // Inline pin/archive. No `touch:false` needed: the table sorts by publishAt, so bumping
  // updatedAt never reorders rows (unlike CrudResource, which sorts by updatedAt).
  const patchField = async (a: Announcement, patch: Partial<Pick<Announcement, 'pinned' | 'active'>>) => {
    setToggling(a.id)
    try {
      await updateAnnouncement(a.id, patch)
      await refresh()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Update failed.', 'error')
    } finally {
      setToggling(null)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: 'Announcement',
      sortAccessor: (a) => a.title,
      render: (a) => (
        <div className="min-w-0 max-w-md">
          <div className="flex items-center gap-1.5">
            {a.pinned && <Pin size={12} className="shrink-0 text-accent-ink" />}
            <span className="font-medium truncate">{a.title}</span>
          </div>
          <div className="text-xs text-muted dark:text-muted-dark truncate">{a.body}</div>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      sortAccessor: (a) => a.audienceType,
      render: (a) => <Badge tone={AUDIENCE_TONE[a.audienceType]}>{AUDIENCE_LABEL[a.audienceType]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortAccessor: (a) => a.status,
      render: (a) => (
        <Badge tone={STATUS_META[a.status].tone} dot>
          {STATUS_META[a.status].label}
        </Badge>
      ),
    },
    {
      key: 'published',
      header: 'Published',
      className: 'text-right',
      sortAccessor: (a) => a.publishAt,
      render: (a) => <span className="text-xs text-faint dark:text-faint-dark">{fmtRelative(a.publishAt)}</span>,
    },
  ]

  if (canManage) {
    // Both inline actions are the same button shell over a different boolean field — build them
    // from one factory rather than two near-identical column defs.
    const toggleColumn = (opts: {
      key: string
      on: (a: Row) => boolean
      patch: (a: Row) => Partial<Pick<Announcement, 'pinned' | 'active'>>
      onLabel: string
      offLabel: string
      onIcon: ReactNode
      offIcon: ReactNode
    }): Column<Row> => ({
      key: opts.key,
      header: '',
      className: 'w-px',
      render: (a) => {
        const on = opts.on(a)
        const label = on ? opts.onLabel : opts.offLabel
        return (
          <button
            className={toggleBtnClass}
            title={label}
            aria-label={label}
            disabled={toggling === a.id}
            onClick={(e) => {
              e.stopPropagation()
              void patchField(a, opts.patch(a))
            }}
          >
            {on ? opts.onIcon : opts.offIcon}
          </button>
        )
      },
    })

    columns.push(
      toggleColumn({
        key: '_pin',
        on: (a) => a.pinned,
        patch: (a) => ({ pinned: !a.pinned }),
        onLabel: 'Unpin',
        offLabel: 'Pin to top',
        onIcon: <PinOff size={13} />,
        offIcon: <Pin size={13} />,
      }),
      toggleColumn({
        key: '_archive',
        on: (a) => a.active,
        patch: (a) => ({ active: !a.active }),
        onLabel: 'Archive — hide from partners',
        offLabel: 'Restore',
        onIcon: <Archive size={13} />,
        offIcon: <ArchiveRestore size={13} />,
      }),
      {
        key: '_edit',
        header: '',
        className: 'w-10 text-right',
        render: () => <Pencil size={13} className="text-faint inline" />,
      },
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Comms"
        title="Announcements"
        description="Broadcast updates to partners and internal teams. Pin the important ones, set an expiry, or archive what's stale."
        actions={
          canManage ? (
            <button className="btn-accent" onClick={openNew}>
              <Plus size={15} /> New announcement
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={<Megaphone size={15} />} />
        <StatCard label="Live" value={stats.live} sub="visible to partners" icon={<Radio size={15} />} />
        <StatCard label="Pinned" value={stats.pinned} icon={<Pin size={15} />} />
        <StatCard label="Expired" value={stats.expired} sub="auto-hidden" icon={<Clock size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            className="input pl-8 h-9 w-60"
            placeholder="Search title or body…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button key={s.value} onClick={() => setStatus(s.value)} className={chipClass(status === s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setAudience('all')} className={chipClass(audience === 'all')}>
            Any audience
          </button>
          {AUDIENCE_TYPES.map((a) => (
            <button key={a.value} onClick={() => setAudience(a.value)} className={chipClass(audience === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={canManage ? openEdit : undefined}
        empty={
          announcements.length === 0
            ? 'No announcements yet. Create your first one.'
            : 'No announcements match these filters.'
        }
        defaultSort={{ key: 'published', dir: 'desc' }}
      />

      <Modal
        open={creating || !!editing}
        onClose={close}
        wide
        title={creating ? 'New announcement' : 'Edit announcement'}
        footer={
          <>
            {editing && !creating && (
              <button className="btn-danger mr-auto" onClick={remove} disabled={busy}>
                Delete
              </button>
            )}
            <button className="btn-ghost" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button className="btn-accent" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : creating ? 'Publish' : 'Save'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Field label="Expire on" htmlFor="ann-expire" hint="Optional — auto-hidden from partners after this date.">
              <input
                id="ann-expire"
                type="date"
                className="input"
                value={form.expireOn}
                onChange={(e) => setForm((f) => ({ ...f, expireOn: e.target.value }))}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
            />
            Pin to top
          </label>
        </div>
      </Modal>
    </div>
  )
}
