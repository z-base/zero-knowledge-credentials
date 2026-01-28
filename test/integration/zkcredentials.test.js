import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { ZKCredentials } from '../../dist/ZKCredentials/class.js'

const baseSnapshot = {
  window: globalThis.window,
  navigator: globalThis.navigator,
  PublicKeyCredential: globalThis.PublicKeyCredential,
  cryptoDesc: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
}

const setGlobalCrypto = (value) => {
  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    enumerable: true,
    writable: false,
  })
}

const restoreGlobals = (snapshot) => {
  if (snapshot.window === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = snapshot.window
  }

  if (snapshot.navigator === undefined) {
    delete globalThis.navigator
  } else {
    globalThis.navigator = snapshot.navigator
  }

  if (snapshot.PublicKeyCredential === undefined) {
    delete globalThis.PublicKeyCredential
  } else {
    globalThis.PublicKeyCredential = snapshot.PublicKeyCredential
  }

  if (snapshot.cryptoDesc) {
    Object.defineProperty(globalThis, 'crypto', snapshot.cryptoDesc)
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

const makeCredential = ({
  type = 'public-key',
  prfResults,
  rawId,
  prfResultsGetter,
} = {}) => {
  const results = prfResults ?? {
    first: makeBytes(32, 10).buffer,
    second: makeBytes(32, 20).buffer,
  }

  const prf = prfResultsGetter
    ? {
        get results() {
          return prfResultsGetter()
        },
      }
    : { results }

  return {
    type,
    rawId: rawId ?? makeBytes(32, 3).buffer,
    getClientExtensionResults() {
      return { prf }
    },
  }
}

const setupEnv = ({
  createImpl,
  getImpl,
  uvAvailable = true,
  includeUvFn = true,
  includePublicKeyCredential = true,
  includeNavigatorCredentials = true,
  globalCrypto = webcrypto,
  windowCrypto,
} = {}) => {
  setGlobalCrypto(globalCrypto)

  const pkc = includePublicKeyCredential
    ? function PublicKeyCredential() {}
    : undefined

  if (pkc && includeUvFn) {
    pkc.isUserVerifyingPlatformAuthenticatorAvailable = async () => uvAvailable
  }

  if (pkc) {
    globalThis.PublicKeyCredential = pkc
  } else {
    delete globalThis.PublicKeyCredential
  }

  const windowObj = {
    location: { hostname: 'zk.test', host: 'zk.test' },
  }

  if (windowCrypto !== undefined) {
    windowObj.crypto = windowCrypto
  } else {
    windowObj.crypto = globalCrypto
  }

  if (pkc) windowObj.PublicKeyCredential = pkc
  globalThis.window = windowObj

  const state = { lastCreateOptions: null, lastGetOptions: null }
  const credentials = includeNavigatorCredentials
    ? {
        create: async (options) => {
          state.lastCreateOptions = options
          if (createImpl) return await createImpl(options)
          return { type: 'public-key' }
        },
        get: async (options) => {
          state.lastGetOptions = options
          if (getImpl) return await getImpl(options)
          return makeCredential()
        },
      }
    : undefined

  globalThis.navigator = includeNavigatorCredentials ? { credentials } : {}

  return { state }
}

test.afterEach(() => {
  restoreGlobals(baseSnapshot)
})

test('registerCredential returns unsupported when window is missing', async () => {
  delete globalThis.window
  delete globalThis.PublicKeyCredential
  delete globalThis.navigator

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when PublicKeyCredential is missing', async () => {
  setupEnv({ includePublicKeyCredential: false })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when navigator.credentials is missing', async () => {
  setupEnv({ includeNavigatorCredentials: false })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when window.crypto is missing', async () => {
  setupEnv({ windowCrypto: null })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when window.crypto.subtle is missing', async () => {
  setupEnv({ windowCrypto: {} })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when platform UV check is unavailable', async () => {
  setupEnv({ includeUvFn: false })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential returns unsupported when platform UV is false', async () => {
  setupEnv({ uvAvailable: false })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential skips UV check for cross-platform authenticators', async () => {
  const { state } = setupEnv({ includeUvFn: false })

  await ZKCredentials.registerCredential('User', 'cross-platform')
  assert.ok(state.lastCreateOptions)
})

test('registerCredential maps AbortError to aborted', async () => {
  setupEnv({
    createImpl: () => {
      const error = new Error('AbortError')
      error.name = 'AbortError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'aborted'
  )
})

test('registerCredential maps NotAllowedError to user-denied', async () => {
  setupEnv({
    createImpl: () => {
      const error = new Error('NotAllowedError')
      error.name = 'NotAllowedError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'user-denied'
  )
})

test('registerCredential maps NotSupportedError to unsupported', async () => {
  setupEnv({
    createImpl: () => {
      const error = new Error('NotSupportedError')
      error.name = 'NotSupportedError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential maps SecurityError to unsupported', async () => {
  setupEnv({
    createImpl: () => {
      const error = new Error('SecurityError')
      error.name = 'SecurityError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (error) => error?.code === 'unsupported'
  )
})

test('registerCredential rethrows unknown errors', async () => {
  const error = new Error('boom')
  setupEnv({
    createImpl: () => {
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.registerCredential('User', 'platform'),
    (thrown) => thrown === error
  )
})

test('registerCredential passes expected creation options', async () => {
  const { state } = setupEnv()

  await ZKCredentials.registerCredential('Alice', 'platform')
  const { publicKey } = state.lastCreateOptions

  assert.equal(publicKey.rp.id, 'zk.test')
  assert.equal(publicKey.rp.name, 'zk.test')
  assert.equal(publicKey.user.name, 'Alice')
  assert.equal(publicKey.user.displayName, 'Alice')
  assert.equal(publicKey.user.id.byteLength ?? publicKey.user.id.length, 32)
  assert.equal(publicKey.challenge.byteLength ?? publicKey.challenge.length, 32)
  assert.equal(
    publicKey.authenticatorSelection.authenticatorAttachment,
    'platform'
  )
  assert.equal(publicKey.authenticatorSelection.residentKey, 'required')
  assert.equal(publicKey.authenticatorSelection.userVerification, 'required')
  assert.equal(publicKey.timeout, 60_000)
  assert.equal(publicKey.attestation, 'none')
})

test('discoverCredential returns unsupported when window is missing', async () => {
  delete globalThis.window
  delete globalThis.PublicKeyCredential
  delete globalThis.navigator

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'unsupported'
  )
})

test('discoverCredential maps AbortError to aborted', async () => {
  setupEnv({
    getImpl: () => {
      const error = new Error('AbortError')
      error.name = 'AbortError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'aborted'
  )
})

test('discoverCredential maps NotAllowedError to user-denied', async () => {
  setupEnv({
    getImpl: () => {
      const error = new Error('NotAllowedError')
      error.name = 'NotAllowedError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'user-denied'
  )
})

test('discoverCredential maps NotSupportedError to unsupported', async () => {
  setupEnv({
    getImpl: () => {
      const error = new Error('NotSupportedError')
      error.name = 'NotSupportedError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'unsupported'
  )
})

test('discoverCredential maps SecurityError to unsupported', async () => {
  setupEnv({
    getImpl: () => {
      const error = new Error('SecurityError')
      error.name = 'SecurityError'
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'unsupported'
  )
})

test('discoverCredential rethrows unknown errors', async () => {
  const error = new Error('boom')
  setupEnv({
    getImpl: () => {
      throw error
    },
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (thrown) => thrown === error
  )
})

test('discoverCredential returns no-credential when get returns null', async () => {
  setupEnv({ getImpl: () => null })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'no-credential'
  )
})

test('discoverCredential returns no-credential when type is not public-key', async () => {
  setupEnv({ getImpl: () => makeCredential({ type: 'password' }) })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'no-credential'
  )
})

test('discoverCredential returns prf-unavailable when results are missing', async () => {
  setupEnv({
    getImpl: () => ({
      type: 'public-key',
      rawId: makeBytes(32).buffer,
      getClientExtensionResults() {
        return {}
      },
    }),
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'prf-unavailable'
  )
})

test('discoverCredential preserves prf-unavailable from fromPRF', async () => {
  setupEnv({
    getImpl: () =>
      makeCredential({
        prfResults: { first: makeBytes(32).buffer },
      }),
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'prf-unavailable'
  )
})

test('discoverCredential maps non-credential errors to key-derivation-failed', async () => {
  setupEnv({
    getImpl: () =>
      makeCredential({
        prfResults: { first: 1, second: 2 },
      }),
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'key-derivation-failed'
  )
})

test('discoverCredential maps false key derivation to key-derivation-failed', async () => {
  let accessCount = 0
  const prfResultsGetter = () => {
    accessCount += 1
    if (accessCount === 1) return {}
    return undefined
  }

  setupEnv({
    getImpl: () => makeCredential({ prfResultsGetter }),
  })

  await assert.rejects(
    () => ZKCredentials.discoverCredential(),
    (error) => error?.code === 'key-derivation-failed'
  )
})

test('discoverCredential returns derived id and keys', async () => {
  setupEnv()

  const result = await ZKCredentials.discoverCredential()
  assert.match(result.id, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(result.hmacJwk.kty, 'oct')
  assert.equal(result.cipherJwk.kty, 'oct')
})

test('discoverCredential passes expected get options', async () => {
  const { state } = setupEnv()

  await ZKCredentials.discoverCredential()
  const { publicKey } = state.lastGetOptions

  assert.equal(publicKey.rpId, 'zk.test')
  assert.equal(publicKey.allowCredentials.length, 0)
  assert.equal(publicKey.userVerification, 'required')
  assert.equal(publicKey.timeout, 60_000)
  assert.equal(state.lastGetOptions.mediation, 'required')
})

test('generateCredential returns expected shape', async () => {
  setGlobalCrypto(webcrypto)

  const result = await ZKCredentials.generateCredential()
  assert.match(result.id, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(result.hmacJwk.kty, 'oct')
  assert.equal(result.cipherJwk.kty, 'oct')
})
