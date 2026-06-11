// Plain-JS entry shim for hosts that boot a fixed .js entry file (e.g.
// Hostinger web-app hosting) and can't run an npm script. Logs immediately on
// start and traps every failure mode so a broken boot is never silent, then
// registers the tsx loader and hands off to the real TypeScript server entry.
console.log(`[boot] server.js starting (node ${process.version}, PORT=${process.env.PORT ?? 'unset'}, cwd=${process.cwd()})`)

process.on('uncaughtException', (error) => {
  console.error('[boot] uncaughtException:', error)
  process.exit(1)
})
process.on('unhandledRejection', (error) => {
  console.error('[boot] unhandledRejection:', error)
  process.exit(1)
})

try {
  const { register } = await import('tsx/esm/api')
  register()
  await import('./server/index.ts')
  console.log('[boot] server entry loaded.')
} catch (error) {
  console.error('[boot] failed to start server:', error)
  process.exit(1)
}
