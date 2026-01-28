import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { build } from 'esbuild'

const outDir = resolve(process.cwd(), 'test', 'e2e', 'fixtures')
const entryFile = resolve(outDir, 'entry.js')
const bundleFile = resolve(outDir, 'zkcredentials.bundle.js')

await build({
  entryPoints: [entryFile],
  outfile: bundleFile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  globalName: 'ZKCredentialsBundle',
  external: ['node:*'],
})

const cli = resolve(
  process.cwd(),
  'node_modules',
  '@playwright',
  'test',
  'cli.js'
)
const result = spawnSync(
  process.execPath,
  [cli, 'test', '--config', 'playwright.config.ts'],
  {
    stdio: 'inherit',
    env: process.env,
  }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
