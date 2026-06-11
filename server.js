// Plain-JS entry shim for hosts that boot a fixed .js entry file. Hostinger's
// LiteSpeed runner (lsnode.js) loads this with require(), which rejects any ESM
// graph containing top-level await (ERR_REQUIRE_ASYNC_MODULE) — so all async
// boot work lives in a promise chain instead. Logs immediately on start and
// traps every failure mode so a broken boot is never silent.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

console.log(`[boot] server.js starting (node ${process.version}, PORT=${process.env.PORT ?? 'unset'}, cwd=${process.cwd()})`)

// LiteSpeed proxies to port 3000 by convention and does not inject PORT.
process.env.PORT = process.env.PORT || '3000'

process.on('uncaughtException', (error) => {
  console.error('[boot] uncaughtException:', error)
  process.exit(1)
})
process.on('unhandledRejection', (error) => {
  console.error('[boot] unhandledRejection:', error)
  process.exit(1)
})

// Prefer the precompiled bundle (emitted by `npm run build:server`): it needs no
// tsx/esbuild at runtime, which shared hosts may block from spawning (EACCES on
// native binaries). Fall back to on-the-fly tsx loading for local/dev use.
const bundled = new URL('./dist-server/index.js', import.meta.url)

const boot = existsSync(fileURLToPath(bundled))
  ? import(bundled.href).then(() => console.log('[boot] bundled server loaded.'))
  : import('tsx/esm/api').then(({ register }) => {
      register()
      return import('./server/index.ts')
    }).then(() => console.log('[boot] tsx server loaded.'))

boot.catch((error) => {
  console.error('[boot] failed to start server:', error)
  process.exit(1)
})
