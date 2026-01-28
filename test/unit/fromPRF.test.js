import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { fromPRF } from '../../dist/ZKCredentials/fromPRF.js'

const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

const setGlobalCrypto = (value) => {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    enumerable: true,
    writable: false,
  })
}

const restoreGlobalCrypto = () => {
  if (cryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor)
  } else {
    delete globalThis.crypto
  }
}

const makeBytes = (size, seed = 1) => {
  const bytes = new Uint8Array(size)
  for (let index = 0; index < size; index++) {
    bytes[index] = (seed + index) & 0xff
  }
  return bytes
}

test('fromPRF returns false when results are undefined', async () => {
  setGlobalCrypto(webcrypto)
  try {
    const result = await fromPRF(undefined)
    assert.equal(result, false)
  } finally {
    restoreGlobalCrypto()
  }
})

test('fromPRF throws prf-unavailable when results are incomplete', async () => {
  setGlobalCrypto(webcrypto)
  try {
    await assert.rejects(
      () => fromPRF({ first: makeBytes(32).buffer }),
      (error) => error?.code === 'prf-unavailable'
    )
  } finally {
    restoreGlobalCrypto()
  }
})

test('fromPRF throws unsupported when subtle crypto is missing', async () => {
  setGlobalCrypto({ getRandomValues: (view) => view })
  try {
    await assert.rejects(
      () =>
        fromPRF({
          first: makeBytes(32).buffer,
          second: makeBytes(32, 2).buffer,
        }),
      (error) => error?.code === 'unsupported'
    )
  } finally {
    restoreGlobalCrypto()
  }
})

test('fromPRF derives hmac and cipher keys', async () => {
  setGlobalCrypto(webcrypto)
  try {
    const result = await fromPRF({
      first: makeBytes(32, 10).buffer,
      second: makeBytes(32, 20).buffer,
    })
    assert.ok(result)
    assert.equal(result.hmacJwk.kty, 'oct')
    assert.equal(result.cipherJwk.kty, 'oct')
    assert.ok(result.hmacJwk.key_ops?.includes('sign'))
    assert.ok(result.cipherJwk.key_ops?.includes('encrypt'))
  } finally {
    restoreGlobalCrypto()
  }
})
