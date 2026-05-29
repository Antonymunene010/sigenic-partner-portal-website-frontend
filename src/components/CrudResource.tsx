import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { Modal } from './Modal'
import { DataTable, type Column } from './DataTable'
import { Field, useToast } from './ui'
import { uid } from '../lib/storage'
import { createResource, updateResource, deleteResource, type ResourceName } from '../lib/api'

export interface FieldSpec {
  key: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  full?: boolean
  help?: string
  defaultValue?: unknown
}

type Row = { id: string }

export function CrudResource<T extends Row>({
  title,
  description,
  resource,
  rows,
  refresh,
  columns,
  fields,
  idPrefix,
  canManage,
  newLabel,
}: {
  title: string
  description?: string
  resource: ResourceName
  rows: T[]
  refresh: () => Promise<void>
  columns: Column<T>[]
  fields: FieldSpec[]
  idPrefix: string
  canManage: boolean
  newLabel?: string
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<T | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)

  const open = (row: T | null) => {
    if (!canManage) return
    setEditing(row)
    setCreating(!row)
    const initial: Record<string, unknown> = {}
    for (const f of fields) {
      if (row) initial[f.key] = (row as Record<string, unknown>)[f.key] ?? ''
      else initial[f.key] = f.defaultValue ?? (f.type === 'checkbox' ? false : '')
    }
    setForm(initial)
  }
  const close = () => {
    setEditing(null)
    setCreating(false)
  }

  const coerce = () => {
    const out: Record<string, unknown> = {}
    for (const f of fields) {
      let v = form[f.key]
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v)
      else if (f.type === 'checkbox') v = Boolean(v)
      else if ((f.type === 'select' || f.type === 'text' || f.type === 'date') && v === '') v = null
      out[f.key] = v
    }
    return out
  }

  const save = async () => {
    for (const f of fields) {
      if (f.required && (form[f.key] === '' || form[f.key] == null)) {
        toast.push(`${f.label} is required.`, 'error')
        return
      }
    }
    setBusy(true)
    try {
      const payload = coerce()
      if (creating) await createResource(resource, { ...payload, id: uid(idPrefix) } as Partial<T>)
      else if (editing) await updateResource(resource, editing.id, payload as Partial<T>)
      await refresh()
      toast.push(creating ? 'Created.' : 'Saved.')
      close()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Save failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!editing) return
    if (!confirm(`Delete this ${title.replace(/s$/, '').toLowerCase()}?`)) return
    setBusy(true)
    try {
      await deleteResource(resource, editing.id)
      await refresh()
      toast.push('Deleted.')
      close()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Delete failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const allColumns: Column<T>[] = canManage
    ? [...columns, { key: '_edit', header: '', className: 'w-10 text-right', render: () => <Pencil size={13} className="text-faint inline" /> }]
    : columns

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted dark:text-muted-dark mt-0.5">{description}</p>}
        </div>
        {canManage && (
          <button className="btn-accent" onClick={() => open(null)}>
            <Plus size={14} /> {newLabel ?? 'New'}
          </button>
        )}
      </div>

      <DataTable columns={allColumns} rows={rows} onRowClick={canManage ? open : undefined} />

      <Modal
        open={creating || !!editing}
        onClose={close}
        title={creating ? `New ${title.replace(/s$/, '')}` : `Edit ${title.replace(/s$/, '')}`}
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
            <button className="btn-accent" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : undefined}>
              <Field label={f.label} hint={f.help}>
                {f.type === 'textarea' ? (
                  <textarea
                    className="textarea min-h-[90px]"
                    placeholder={f.placeholder}
                    value={(form[f.key] as string) ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                ) : f.type === 'select' ? (
                  <select className="select" value={(form[f.key] as string) ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}>
                    <option value="">—</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <label className="inline-flex items-center gap-2 text-sm h-10">
                    <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.checked }))} />
                    {f.placeholder ?? 'Enabled'}
                  </label>
                ) : (
                  <input
                    className="input"
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    placeholder={f.placeholder}
                    value={(form[f.key] as string) ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
