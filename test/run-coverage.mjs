import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import fg from 'fast-glob'

const coverageDir = resolve(process.cwd(), '.c8')
rmSync(coverageDir, { recursive: true, force: true })

const env = { ...process.env, NODE_V8_COVERAGE: coverageDir }

function run(command, args, envOverride = env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: envOverride,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const unitTests = fg.sync('test/unit/**/*.test.js')
const integrationTests = fg.sync('test/integration/**/*.test.js')

run(process.execPath, ['--test', '--test-concurrency=1', ...unitTests])
run(process.execPath, ['--test', '--test-concurrency=1', ...integrationTests])

const c8Bin = resolve(process.cwd(), 'node_modules', 'c8', 'bin', 'c8.js')
run(
  process.execPath,
  [
    c8Bin,
    'report',
    '--check-coverage',
    '--lines',
    '100',
    '--branches',
    '100',
    '--functions',
    '100',
    '--statements',
    '100',
    '--temp-directory',
    coverageDir,
    '--reporter',
    'text',
    '--reporter',
    'lcov',
  ],
  process.env
)

rmSync(coverageDir, { recursive: true, force: true })
