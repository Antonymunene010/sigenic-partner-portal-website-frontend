import fs from 'node:fs'
import path from 'node:path'
import type { Request, Response } from 'express'

function contentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

/**
 * SPA static server with a directory-traversal guard. Serves built files from
 * dist/, falling back to index.html for client-side routes.
 */
export function makeServeStatic(root: string) {
  const dist = path.join(root, 'dist')
  return function serveStatic(req: Request, res: Response): void {
    const requested = path.normalize(decodeURIComponent(req.path)).replace(/^(\.\.[/\\])+/, '')
    const filePath = path.join(dist, requested === '/' ? 'index.html' : requested)
    const target = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(dist, 'index.html')
    if (!fs.existsSync(target)) {
      res.status(404).type('text/plain').send('Build not found. Run `npm run build` before `npm start`.')
      return
    }
    res.type(contentType(target))
    fs.createReadStream(target).pipe(res)
  }
}
