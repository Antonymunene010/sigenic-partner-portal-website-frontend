// Seeded demo accounts — keep in sync with the user rows in
// `server/db/seed.ts`. Match is case-insensitive.
const DEMO_EMAILS: ReadonlySet<string> = new Set([
  'founder-demo@sigenic.com',
  'admin-demo@sigenic.com',
  'support-demo@sigenic.com',
  'admin@apacpartners.com',
  'leo@apacpartners.com',
  'karen@novacell.sg',
  'wei@novacell.sg',
  'daniel@quantex.com',
  'mara@quantex.com',
])

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return DEMO_EMAILS.has(email.toLowerCase())
}
