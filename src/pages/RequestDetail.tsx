import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Send, ExternalLink } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useData, useLookups } from '../lib/data'
import { isInternal } from '../lib/permissions'
import { addServiceRequestMessage, updateServiceRequest } from '../lib/api'
import { Card, Field, EmptyState, useToast } from '../components/ui'
import { Badge } from '../components/Badge'
import { Avatar } from '../components/Avatar'
import { DescRow } from '../components/DescRow'
import { fmtDateTime } from '../lib/format'
import { REQUEST_STATUSES, REQUEST_STATUS_TONE, REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, URGENCY_TONE, OWNER_TEAMS, REQUEST_SOURCE_LABEL } from '../lib/constants'
import type { OwnerTeam, RequestStatus } from '../lib/types'

export default function RequestDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { serviceRequests, refresh } = useData()
  const lookups = useLookups()
  const toast = useToast()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const sr = serviceRequests.find((r) => r.id === id)
  if (!sr) {
    return (
      <Card>
        <EmptyState title="Request not found" hint="It may belong to another company." action={<Link to="/app/requests" className="btn-outline">Back to requests</Link>} />
      </Card>
    )
  }

  const internal = isInternal(user)

  const sendReply = async () => {
    if (!reply.trim()) return
    setBusy(true)
    try {
      await addServiceRequestMessage(sr.id, reply.trim())
      setReply('')
      await refresh()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Failed to send.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const setField = async (fields: { status?: RequestStatus; ownerTeam?: OwnerTeam }) => {
    try {
      await updateServiceRequest(sr.id, fields)
      await refresh()
      toast.push('Updated.')
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Update failed.', 'error')
    }
  }

  return (
    <div>
      <Link to="/app/requests" className="inline-flex items-center gap-1.5 text-sm text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark mb-4">
        <ArrowLeft size={14} /> Requests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge tone={REQUEST_STATUS_TONE[sr.status]} dot>{REQUEST_STATUS_LABEL[sr.status]}</Badge>
            <Badge tone={URGENCY_TONE[sr.urgency]}>{sr.urgency}</Badge>
            <span className="text-xs font-mono text-faint">{sr.id}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{sr.title}</h1>
        </div>
        {sr.zendeskTicketId && (
          <Badge tone="info">
            <ExternalLink size={11} /> Zendesk #{sr.zendeskTicketId}
          </Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {sr.description && (
            <Card title="Description">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/90 dark:text-ink-dark/90">{sr.description}</p>
            </Card>
          )}

          <Card title="Conversation">
            {sr.messages.length === 0 ? (
              <EmptyState title="No messages yet" hint={sr.requestType === 'support' ? 'Replies sync with the linked Zendesk ticket.' : 'Add a note for the Sigenic team.'} />
            ) : (
              <ul className="space-y-4">
                {sr.messages.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <Avatar name={m.author} variant={m.authorRole === 'you' ? 'accent' : 'faint'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.author}</span>
                        <span className="text-[11px] font-mono text-faint">{fmtDateTime(m.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink/90 dark:text-ink-dark/90">{m.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 pt-4 border-t border-line dark:border-line-dark">
              <textarea className="textarea min-h-[80px]" placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="mt-2 flex justify-end">
                <button className="btn-accent" onClick={sendReply} disabled={busy || !reply.trim()}>
                  <Send size={14} /> {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Details">
            <dl className="space-y-2.5 text-sm">
              <DescRow k="Type" v={REQUEST_TYPE_LABEL[sr.requestType]} />
              <DescRow k="Owner team" v={<span className="capitalize">{sr.ownerTeam}</span>} />
              <DescRow k="Source" v={REQUEST_SOURCE_LABEL[sr.source]} />
              {sr.companyId && <DescRow k="Company" v={lookups.companyName(sr.companyId)} />}
              {sr.siteId && <DescRow k="Site" v={lookups.siteName(sr.siteId)} />}
              {sr.departmentId && <DescRow k="Department" v={lookups.departmentName(sr.departmentId)} />}
              {sr.machineId && <DescRow k="Machine" v={lookups.machineName(sr.machineId)} />}
              {sr.contactEmail && <DescRow k="Contact" v={sr.contactEmail} />}
              <DescRow k="Created" v={fmtDateTime(sr.createdAt)} />
            </dl>
          </Card>

          {internal && (
            <Card title="Manage" eyebrow="Internal">
              <div className="space-y-3">
                <Field label="Status">
                  <select className="select" value={sr.status} onChange={(e) => setField({ status: e.target.value as RequestStatus })}>
                    {REQUEST_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Owner team">
                  <select className="select" value={sr.ownerTeam} onChange={(e) => setField({ ownerTeam: e.target.value as OwnerTeam })}>
                    {OWNER_TEAMS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                {sr.zendeskTicketId && <p className="text-xs text-muted dark:text-muted-dark">Ticket execution stays in Zendesk (#{sr.zendeskTicketId}).</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
