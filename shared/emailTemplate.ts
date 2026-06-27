/**
 * Single authoritative source for the email-template wire shape + render helpers.
 *
 * The server holds the default subject/body strings and the per-slug DB override
 * lookup; this module just nails down the types both sides exchange and the
 * pure-string render helpers the admin editor uses for the live preview (so
 * what the super-admin sees matches what the SMTP path actually produces).
 */

/** Metadata for one placeholder a super-admin can use inside a template body. */
export interface EmailTemplateVar {
  name: string
  description: string
  example: string
}

/** Authoritative definition of one outbound template — default subject/body
 *  plus the placeholder catalog the editor surfaces to the super-admin. */
export interface EmailTemplateDef {
  slug: string
  name: string
  description: string
  variables: EmailTemplateVar[]
  subject: string
  body: string
}

/** Projection sent to the admin editor: defaults + current override bundled so
 *  the UI can populate the form, show a "customized" badge, and offer reset
 *  without a second round-trip. */
export interface EmailTemplateView {
  slug: string
  name: string
  description: string
  variables: EmailTemplateVar[]
  defaultSubject: string
  defaultBody: string
  subject: string
  body: string
  customized: boolean
  updatedBy: string | null
  updatedAt: string | null
}

/** One casing filter a super-admin can append to a placeholder. The same entry
 *  drives both render-time transformation (`apply`) AND the admin editor's
 *  quick-copy chips (`label`/`tip`) — keeping these together means adding a
 *  filter requires editing only this file, no separate UI registry. */
export interface TemplateFilter {
  apply: (s: string) => string
  label: string
  tip: string
}

/** `{{action|upper}}` → "CREATED". `capitalize` is first-letter-upper +
 *  rest-lower (e.g. "created" → "Created"), matching the common admin-editor
 *  use case rather than title-casing every word. Unknown filters fall through
 *  to the raw value so a typo never silently swallows the field.
 *
 *  Insertion order is the order the admin editor displays the quick-copy chips
 *  (Aa → aa → AA), so reorder entries here to reorder the UI. */
export const TEMPLATE_FILTERS: Record<string, TemplateFilter> = {
  capitalize: {
    apply: (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
    label: 'Aa',
    tip: 'Capitalized — e.g. "Created"',
  },
  lower: {
    apply: (s) => s.toLowerCase(),
    label: 'aa',
    tip: 'lowercase — e.g. "created"',
  },
  upper: {
    apply: (s) => s.toUpperCase(),
    label: 'AA',
    tip: 'UPPERCASE — e.g. "CREATED"',
  },
}

/** Replace `{{name}}` or `{{name|filter}}` (with optional surrounding
 *  whitespace). Unknown vars collapse to empty string, matching the
 *  "missing field = drop the line" behaviour the original template literals
 *  had. Unknown filters render the raw value rather than empty, so a typo
 *  degrades to "uncased" rather than "blank field". */
export function renderString(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*\|\s*([a-zA-Z_][a-zA-Z0-9_]*))?\s*\}\}/g,
    (_, key, filter) => {
      const raw = vars[key] ?? ''
      return filter ? TEMPLATE_FILTERS[filter]?.apply(raw) ?? raw : raw
    },
  )
}

/** Optional sections frequently collapse a multi-line block to nothing; squash
 *  the resulting run of blank lines so the message never ships with awkward
 *  vertical gaps. Two consecutive newlines = one paragraph break is preserved.
 *  Trailing newline is preserved on the server (sendEmail's `text` field) and
 *  trimmed on the client (preview block); both call sites tidy explicitly. */
export function tidyBlankLines(s: string): string {
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}
