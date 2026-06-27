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

/** Replace `{{name}}` (with optional surrounding whitespace) — unknown vars
 *  collapse to empty string, matching the "missing field = drop the line"
 *  behaviour the original template literals had. */
export function renderString(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

/** Optional sections frequently collapse a multi-line block to nothing; squash
 *  the resulting run of blank lines so the message never ships with awkward
 *  vertical gaps. Two consecutive newlines = one paragraph break is preserved.
 *  Trailing newline is preserved on the server (sendEmail's `text` field) and
 *  trimmed on the client (preview block); both call sites tidy explicitly. */
export function tidyBlankLines(s: string): string {
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
}
