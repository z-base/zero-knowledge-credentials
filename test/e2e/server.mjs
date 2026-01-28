import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

const rootDir = resolve(process.cwd())
const indexPath = resolve(rootDir, 'test', 'e2e', 'index.html')
const port = Number(process.env.PORT ?? 4173)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url ?? '/',
      `http://${req.headers.host ?? '127.0.0.1'}`
    )
    const pathname =
      url.pathname === '/' ? '/test/e2e/index.html' : url.pathname
    const filePath = resolve(rootDir, pathname.slice(1))

    if (!filePath.startsWith(rootDir)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    const data = await readFile(filePath)
    const ext = extname(filePath)
    res.statusCode = 200
    res.setHeader(
      'Content-Type',
      contentTypes[ext] ?? 'application/octet-stream'
    )
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end('Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`e2e server listening on http://127.0.0.1:${port}`)
})
