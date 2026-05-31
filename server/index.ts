import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFile } from './config/env'
import { warnOnInsecureSecret } from './infra/auth'
import { createStore } from './db/store'
import { initEmail } from './infra/email'
import { zendeskEnabled } from './integration/zendesk'
import { notionEnabled } from './integration/notion'
import { runZendeskSync } from './services/serviceRequest.service'
import { syncNotionArticles } from './services/knowledge.service'
import { buildApp } from './app'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
loadEnvFile(path.join(root, '.env'))
warnOnInsecureSecret()

const port = Number(process.env.PORT ?? 8787)

/**
 * Run `fn` on a fixed interval with NO overlapping cycles: the next run is armed
 * only after the current one settles. Fires once immediately. `.unref()` lets the
 * process exit cleanly.
 */
function scheduleLoop(fn: () => Promise<unknown>, intervalMs: number, label: string): void {
  const tick = async () => {
    try {
      await fn()
    } catch (error: any) {
      console.warn(`[${label}] cycle failed: ${error.message}`)
    } finally {
      setTimeout(tick, intervalMs).unref()
    }
  }
  tick()
}

const store = createStore()
await store.init()
await initEmail()

if (zendeskEnabled()) {
  const interval = Number(process.env.ZENDESK_SYNC_INTERVAL_MS || 60000)
  scheduleLoop(() => runZendeskSync(store), interval, 'zendesk:sync')
  console.log(`[zendesk] two-way sync enabled (every ${interval}ms).`)
}

if (notionEnabled()) {
  const interval = Number(process.env.NOTION_SYNC_INTERVAL_MS || 300000)
  scheduleLoop(() => syncNotionArticles(store), interval, 'notion:sync')
  console.log(`[notion] knowledge-base sync enabled (every ${interval}ms).`)
}

const app = buildApp(store, root)
app.listen(port, () => {
  console.log(`Sigenic Partner Portal API listening on http://localhost:${port}`)
})
