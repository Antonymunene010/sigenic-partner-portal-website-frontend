// Plain-JS entry shim for hosts that boot a fixed .js entry file (e.g.
// Hostinger web-app hosting) and can't run an npm script. Registers the tsx
// loader, then hands off to the real TypeScript server entry.
import { register } from 'tsx/esm/api'

register()
await import('./server/index.ts')
