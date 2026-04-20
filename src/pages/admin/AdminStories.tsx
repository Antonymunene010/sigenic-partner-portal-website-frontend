import { useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, Star } from 'lucide-react'
import { load, save, uid } from '../../lib/storage'
import type { SuccessStory } from '../../lib/types'
import { seedStories } from '../../lib/seed'
import { fmtDate } from '../../lib/format'

export default function AdminStories() {
  const [stories, setStories] = useState<SuccessStory[]>(() => load<SuccessStory[]>('stories', seedStories))
  const [editing, setEditing] = useState<SuccessStory | null>(null)
  const [isNew, setIsNew] = useState(false)

  const persist = (next: SuccessStory[]) => {
    save('stories', next)
    setStories(next)
  }

  const startNew = () => {
    setIsNew(true)
    setEditing({
      id: uid('s'),
      slug: '',
      title: '',
      summary: '',
      partner: '',
      industry: '',
      region: '',
      theme: 'yield',
      metrics: [
        { label: 'Metric A', value: '' },
        { label: 'Metric B', value: '' },
        { label: 'Metric C', value: '' },
      ],
      body: '',
      publishedAt: new Date().toISOString(),
      featured: false,
    })
  }
  const startEdit = (s: SuccessStory) => { setIsNew(false); setEditing({ ...s }) }
  const cancel = () => { setEditing(null); setIsNew(false) }
  const saveEdit = () => {
    if (!editing) return
    const slugged = editing.slug || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const s = { ...editing, slug: slugged }
    if (isNew) persist([s, ...stories])
    else persist(stories.map((x) => (x.id === s.id ? s : x)))
    cancel()
  }
  const del = (id: string) => persist(stories.filter((s) => s.id !== id))
  const feature = (id: string) => persist(stories.map((s) => (s.id === id ? { ...s, featured: !s.featured } : s)))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Success stories</h2>
          <p className="text-[12.5px] text-muted dark:text-muted-dark mt-0.5">Publish partner outcomes with measured metrics.</p>
        </div>
        <button onClick={startNew} className="btn-accent h-9 text-[12px]"><Plus size={12} /> New story</button>
      </div>

      {editing && (
        <div className="card p-5 mb-5 animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-medium">{isNew ? 'New story' : 'Edit story'}</div>
            <div className="flex gap-2">
              <button onClick={cancel} className="btn-outline h-8 text-[12px]"><X size={12} /> Cancel</button>
              <button onClick={saveEdit} className="btn-accent h-8 text-[12px]"><Save size={12} /> Save</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-3">
              <label className="label">Title</label>
              <input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className="label">Slug</label>
              <input className="input font-mono text-[12.5px]" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Partner</label>
              <input className="input" value={editing.partner} onChange={(e) => setEditing({ ...editing, partner: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Industry</label>
              <input className="input" value={editing.industry} onChange={(e) => setEditing({ ...editing, industry: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Region</label>
              <input className="input" value={editing.region} onChange={(e) => setEditing({ ...editing, region: e.target.value })} />
            </div>
            <div className="md:col-span-6">
              <label className="label">Summary</label>
              <textarea className="textarea min-h-[80px]" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            </div>
            <div className="md:col-span-6">
              <label className="label">Body</label>
              <textarea className="textarea min-h-[140px]" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <div className="md:col-span-6">
              <label className="label">Metrics (3 recommended)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {editing.metrics.map((m, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2">
                    <input className="input col-span-2" placeholder="Label" value={m.label} onChange={(e) => {
                      const ms = [...editing.metrics]; ms[i] = { ...ms[i], label: e.target.value }; setEditing({ ...editing, metrics: ms })
                    }} />
                    <input className="input col-span-3 font-mono num" placeholder="Value" value={m.value} onChange={(e) => {
                      const ms = [...editing.metrics]; ms[i] = { ...ms[i], value: e.target.value }; setEditing({ ...editing, metrics: ms })
                    }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-6 flex items-center gap-2">
              <input id="feat" type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              <label htmlFor="feat" className="text-[13px]">Feature on the Stories page</label>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th className="w-40">Partner</th>
              <th className="w-32">Industry</th>
              <th className="w-28">Published</th>
              <th className="w-20">Feat.</th>
              <th className="w-24 text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="text-[13.5px] font-medium">{s.title || <span className="text-faint dark:text-faint-dark italic">Untitled</span>}</div>
                  <div className="text-[11px] font-mono text-faint dark:text-faint-dark mt-0.5">/{s.slug}</div>
                </td>
                <td className="text-[12.5px]">{s.partner}</td>
                <td className="text-[12.5px] text-muted dark:text-muted-dark">{s.industry}</td>
                <td className="text-[11.5px] font-mono text-muted dark:text-muted-dark">{fmtDate(s.publishedAt)}</td>
                <td>
                  <button onClick={() => feature(s.id)} className={`w-7 h-7 flex items-center justify-center rounded-md ${s.featured ? 'text-accent bg-accent/10' : 'text-faint dark:text-faint-dark hover:text-ink dark:hover:text-ink-dark'}`}>
                    <Star size={13} fill={s.featured ? '#CCFF00' : 'none'} />
                  </button>
                </td>
                <td className="text-right pr-3">
                  <div className="inline-flex gap-1">
                    <button onClick={() => startEdit(s)} className="btn-ghost h-7 w-7 p-0"><Pencil size={12} /></button>
                    <button onClick={() => del(s.id)} className="btn-ghost h-7 w-7 p-0 text-danger"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
