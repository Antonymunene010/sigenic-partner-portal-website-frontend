import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useData } from '../lib/data'
import { createServiceRequest } from '../lib/api'
import { PageHeader } from '../components/PageHeader'
import { Card, Field, useToast } from '../components/ui'
import { URGENCIES } from '../lib/constants'
import type { Urgency } from '../lib/types'

export default function NewRequest() {
  const { requestTypes, requestDepartments, requestProcesses, requestMachines, sites, refresh } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // Active request types from config, ordered. The ?type= deep-link is honored only if it's an active slug.
  const types = requestTypes.filter((t) => t.active).sort((a, b) => a.sortOrder - b.sortOrder)
  const [requestType, setRequestType] = useState<string>(params.get('type') ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [departmentId, setDepartmentId] = useState('')
  const [processId, setProcessId] = useState('')
  const [machineId, setMachineId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [busy, setBusy] = useState(false)

  // Selected slug, falling back to the first active type (config loads async — empty until hydrate).
  const selectedType = types.some((t) => t.slug === requestType) ? requestType : types[0]?.slug ?? ''
  const owner = types.find((t) => t.slug === selectedType)?.ownerTeam ?? 'support'
  const deptOptions = requestDepartments.filter((d) => d.active).sort((a, b) => a.sortOrder - b.sortOrder)
  const procOptions = requestProcesses.filter((p) => p.active && (!departmentId || p.requestDepartmentId === departmentId))
  const macOptions = requestMachines.filter((m) => m.active && (!departmentId || m.requestDepartmentId === departmentId))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return toast.push('Add a title.', 'error')
    if (!selectedType) return toast.push('No request type is available.', 'error')
    setBusy(true)
    try {
      const r = await createServiceRequest({
        requestType: selectedType,
        title: title.trim(),
        description: description.trim(),
        urgency,
        departmentId: departmentId || undefined,
        processId: processId || undefined,
        machineId: machineId || undefined,
        siteId: siteId || undefined,
        source: 'portal_form',
      })
      await refresh()
      toast.push(selectedType === 'support' ? 'Support request raised (routed to Zendesk).' : 'Request submitted.')
      navigate(`/app/requests/${r.item.id}`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Submit failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="New request" title="Raise a request" description="Support requests are routed to Zendesk; demos and consultations go to sales; onboarding to ops; feature requests to product." />

      <form onSubmit={submit}>
        <Card>
          <Field label="Request type">
            <div className="grid sm:grid-cols-2 gap-2">
              {types.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setRequestType(t.slug)}
                  className={`text-left p-3 rounded-md border transition ${selectedType === t.slug ? 'border-accent bg-accent/8' : 'border-line dark:border-line-dark hover:bg-raised dark:hover:bg-raised-dark'}`}
                >
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted dark:text-muted-dark mt-0.5">{t.blurb}</div>
                </button>
              ))}
            </div>
          </Field>

          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Title">
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" required />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className="textarea min-h-[120px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide context, machine/process details, what you've tried…" />
              </Field>
            </div>
            <Field label="Urgency">
              <select className="select" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}>
                {URGENCIES.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Site / fab">
              <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">—</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.siteName}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select className="select" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProcessId(''); setMachineId('') }}>
                <option value="">—</option>
                {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Process">
              <select className="select" value={processId} onChange={(e) => setProcessId(e.target.value)}>
                <option value="">—</option>
                {procOptions.map((p) => <option key={p.id} value={p.id}>{p.processName}</option>)}
              </select>
            </Field>
            <Field label="Machine">
              <select className="select" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                <option value="">—</option>
                {macOptions.map((m) => <option key={m.id} value={m.id}>{m.machineName}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-accent" disabled={busy}>
              <Send size={15} /> {busy ? 'Submitting…' : 'Submit request'}
            </button>
            <span className="text-xs text-muted dark:text-muted-dark">Routes to <span className="font-medium capitalize text-emphasis">{owner}</span></span>
          </div>
        </Card>
      </form>
    </div>
  )
}
