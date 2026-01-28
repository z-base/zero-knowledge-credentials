import { performance } from 'node:perf_hooks'
import { webcrypto } from 'node:crypto'
import { ZKCredentials } from '../dist/index.js'
import { fromPRF } from '../dist/ZKCredentials/fromPRF.js'

const ensureCrypto = () => {
  if (globalThis.crypto?.subtle) return
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    enumerable: true,
    writable: false,
  })
}

const parseIterations = (value, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

const defaultIterations = parseIterations(process.env.BENCH_ITERATIONS, 200)
const fromPrfIterations = parseIterations(
  process.env.BENCH_FROMPRF_ITERATIONS,
  defaultIterations
)
const generateIterations = parseIterations(
  process.env.BENCH_GENERATE_ITERATIONS,
  Math.max(20, Math.floor(defaultIterations / 4))
)

const makeBytes = (size, seed = 1) => {
  const bytes = new Uint8Array(size)
  for (let index = 0; index < size; index++) {
    bytes[index] = (seed + index) & 0xff
  }
  return bytes
}

const formatNumber = (value) => value.toLocaleString('en-US')

const bench = async (name, iterations, fn) => {
  const warmup = Math.min(10, iterations)
  for (let index = 0; index < warmup; index++) {
    await fn()
  }

  const start = performance.now()
  for (let index = 0; index < iterations; index++) {
    await fn()
  }
  const durationMs = performance.now() - start
  const perOpMs = durationMs / iterations
  const opsPerSec = 1000 / perOpMs

  console.log(
    `${name}: ${formatNumber(iterations)} ops in ${durationMs.toFixed(2)}ms ` +
      `(${perOpMs.toFixed(3)}ms/op, ${formatNumber(opsPerSec.toFixed(0))} ops/sec)`
  )
}

const run = async () => {
  ensureCrypto()

  const prfResults = {
    first: makeBytes(32, 10).buffer,
    second: makeBytes(32, 20).buffer,
  }

  await bench('fromPRF', fromPrfIterations, async () => {
    const result = await fromPRF(prfResults)
    if (!result) throw new Error('fromPRF returned false')
  })

  await bench('generateCredentials', generateIterations, async () => {
    const result = await ZKCredentials.generateCredentials()
    if (!result?.id) throw new Error('generateCredentials failed')
  })
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
