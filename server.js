// Plain-JS entry shim for hosts that boot a fixed .js entry file. Hostinger's
// LiteSpeed runner (lsnode.js) loads this with require(), which rejects any ESM
// graph containing top-level await (ERR_REQUIRE_ASYNC_MODULE) — so all async
// boot work lives in a promise chain instead. Logs immediately on start and
// traps every failure mode so a broken boot is never silent.
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

import('tsx/esm/api')
  .then(({ register }) => {
    register()
    return import('./server/index.ts')
  })
  .then(() => console.log('[boot] server entry loaded.'))
  .catch((error) => {
    console.error('[boot] failed to start server:', error)
    process.exit(1)
  })
