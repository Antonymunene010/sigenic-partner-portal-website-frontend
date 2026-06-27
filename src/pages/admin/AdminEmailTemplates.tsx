import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Card, Field, Spinner, useToast } from '../../components/ui'
import { Badge } from '../../components/Badge'
import {
  listEmailTemplatesApi,
  updateEmailTemplateApi,
  resetEmailTemplateApi,
} from '../../lib/api'
import { renderString, tidyBlankLines, type EmailTemplateView } from '../../../shared/emailTemplate'
import { fmtRelative } from '../../lib/format'

function exampleVars(t: EmailTemplateView): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of t.variables) out[v.name] = v.example
  return out
}

export default function AdminEmailTemplates() {
  const toast = useToast()
  const [templates, setTemplates] = useState<EmailTemplateView[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { templates: list } = await listEmailTemplatesApi()
        if (cancelled) return
        setTemplates(list)
        if (list.length) setActiveSlug(list[0].slug)
      } catch (error: any) {
        if (!cancelled) toast.push(error?.message ?? 'Failed to load email templates.', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  const active = useMemo(
    () => templates.find((t) => t.slug === activeSlug) ?? null,
    [templates, activeSlug],
  )

  // Switching templates (or saving the current one) snaps the draft back to the
  // persisted subject/body so unsaved edits don't bleed across selections.
  useEffect(() => {
    setDraftSubject(active?.subject ?? '')
    setDraftBody(active?.body ?? '')
  }, [active?.slug, active?.subject, active?.body])

  const dirty = !!active && (draftSubject !== active.subject || draftBody !== active.body)

  const previewVars = active ? exampleVars(active) : {}
  const previewSubject = active ? renderString(draftSubject, previewVars).trim() : ''
  const previewBody = active ? tidyBlankLines(renderString(draftBody, previewVars)).trim() : ''

  async function save() {
    if (!active || !dirty) return
    const subject = draftSubject.trim()
    if (!subject) {
      toast.push('Subject is required.', 'error')
      return
    }
    if (!draftBody.trim()) {
      toast.push('Body is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const { item } = await updateEmailTemplateApi(active.slug, { subject, body: draftBody })
      setTemplates((cur) => cur.map((x) => (x.slug === item.slug ? item : x)))
      toast.push(`Saved "${item.name}".`)
    } catch (error: any) {
      toast.push(error?.message ?? 'Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!active) return
    if (!active.customized) return
    if (!window.confirm(`Reset "${active.name}" to the built-in default? Any customizations will be lost.`)) return
    setResetting(true)
    try {
      const { item } = await resetEmailTemplateApi(active.slug)
      setTemplates((cur) => cur.map((x) => (x.slug === item.slug ? item : x)))
      toast.push(`Reset "${item.name}" to default.`)
    } catch (error: any) {
      toast.push(error?.message ?? 'Reset failed.', 'error')
    } finally {
      setResetting(false)
    }
  }

  function copyPlaceholder(name: string) {
    const ph = `{{${name}}}`
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(ph).catch(() => {})
    }
    toast.push(`Copied ${ph} to clipboard.`, 'info')
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Email Templates"
        description="Edit the subject and body of every outbound email the portal sends. Variables in double curly braces are replaced with live values at send-time — only the wording around them is editable. Super-admin only."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <nav aria-label="Email templates" className="card p-2 h-fit lg:sticky lg:top-20 space-y-0.5">
          {templates.map((t) => {
            const isActive = t.slug === activeSlug
            return (
              <button
                key={t.slug}
                type="button"
                onClick={() => setActiveSlug(t.slug)}
                className={`w-full text-left rounded-md px-3 py-2 transition text-sm ${
                  isActive
                    ? 'bg-accent/12 text-emphasis'
                    : 'text-muted dark:text-muted-dark hover:bg-raised dark:hover:bg-raised-dark hover:text-ink dark:hover:text-ink-dark'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={isActive ? 'font-medium' : ''}>{t.name}</span>
                  {t.customized && <Badge tone="info">edited</Badge>}
                </div>
                <div className="text-xs text-faint dark:text-faint-dark font-mono mt-0.5">{t.slug}</div>
              </button>
            )
          })}
        </nav>

        {active ? (
          <div className="space-y-5">
            <Card
              title={active.name}
              eyebrow={active.slug}
              actions={
                <>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={!active.customized || resetting}
                    className="btn-ghost text-xs disabled:opacity-50"
                  >
                    <RotateCcw size={13} aria-hidden /> Reset to default
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving}
                    className="btn-accent text-xs disabled:opacity-50"
                  >
                    <Save size={13} aria-hidden /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              }
            >
              <p className="text-sm text-muted dark:text-muted-dark mb-4">{active.description}</p>
              {active.customized && active.updatedAt && (
                <p className="text-xs text-faint dark:text-faint-dark mb-4">
                  Customized · last edited {fmtRelative(active.updatedAt)}
                </p>
              )}

              <div className="space-y-4">
                <Field label="Subject" htmlFor={`tpl-subject-${active.slug}`}>
                  <input
                    id={`tpl-subject-${active.slug}`}
                    className="input"
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                  />
                </Field>
                <Field label="Body" htmlFor={`tpl-body-${active.slug}`}>
                  <textarea
                    id={`tpl-body-${active.slug}`}
                    className="textarea font-mono text-[13px] leading-relaxed min-h-[320px]"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Available variables" eyebrow="placeholders">
              <p className="text-xs text-muted dark:text-muted-dark mb-3">
                Click a placeholder to copy it. An unknown variable renders as an empty string at send-time.
              </p>
              <ul className="divide-y divide-line dark:divide-line-dark text-sm">
                {active.variables.map((v) => (
                  <li key={v.name} className="py-2.5 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => copyPlaceholder(v.name)}
                      className="font-mono text-[12px] text-emphasis shrink-0 underline-offset-4 hover:underline"
                    >
                      {`{{${v.name}}}`}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink dark:text-ink-dark">{v.description}</div>
                      <div className="text-xs text-faint dark:text-faint-dark mt-0.5 truncate">
                        e.g. {v.example.includes('\n') ? v.example.replace(/\n/g, ' ⏎ ') : v.example}
                      </div>
                    </div>
                  </li>
                ))}
                {active.variables.length === 0 && (
                  <li className="py-2 text-xs text-faint dark:text-faint-dark">This template has no placeholders.</li>
                )}
              </ul>
            </Card>

            <Card title="Preview" eyebrow="rendered with example values">
              <div className="text-xs uppercase tracking-wide text-faint dark:text-faint-dark mb-1">Subject</div>
              <div className="text-sm font-medium mb-4">
                {previewSubject || <span className="text-faint">(empty)</span>}
              </div>
              <div className="text-xs uppercase tracking-wide text-faint dark:text-faint-dark mb-1">Body</div>
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed font-sans text-ink dark:text-ink-dark">
                {previewBody || <span className="text-faint">(empty)</span>}
              </pre>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="text-sm text-muted dark:text-muted-dark">Select a template to edit.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
