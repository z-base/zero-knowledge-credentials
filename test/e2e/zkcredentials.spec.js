import { expect, test } from '@playwright/test'

const installMocks = () => {
  const state = {
    uvAvailable: true,
    createErrorName: null,
    getErrorName: null,
    returnNullCredential: false,
    credentialType: 'public-key',
    prfResultsMissing: false,
    prfResultsPartial: false,
    prfResultsInvalid: false,
    rawIdSeed: 1,
    prfFirstSeed: 101,
    prfSecondSeed: 202,
    lastCreateOptions: null,
    lastGetOptions: null,
  }

  const makeBytes = (size, seed) => {
    const bytes = new Uint8Array(size)
    for (let index = 0; index < size; index++) {
      bytes[index] = (seed + index) & 0xff
    }
    return bytes
  }

  const makeError = (name) => new DOMException(name, name)

  const buildCredential = () => {
    const rawId = makeBytes(32, state.rawIdSeed).buffer
    if (state.prfResultsMissing) {
      return {
        type: state.credentialType,
        rawId,
        getClientExtensionResults() {
          return {}
        },
      }
    }

    let prfResults
    if (state.prfResultsPartial) {
      prfResults = {
        first: makeBytes(32, state.prfFirstSeed).buffer,
      }
    } else if (state.prfResultsInvalid) {
      prfResults = { first: 1, second: 2 }
    } else {
      prfResults = {
        first: makeBytes(32, state.prfFirstSeed).buffer,
        second: makeBytes(32, state.prfSecondSeed).buffer,
      }
    }

    return {
      type: state.credentialType,
      rawId,
      getClientExtensionResults() {
        return { prf: { results: prfResults } }
      },
    }
  }

  const create = async (options) => {
    state.lastCreateOptions = options
    if (state.createErrorName) throw makeError(state.createErrorName)
    return { type: 'public-key' }
  }

  const get = async (options) => {
    state.lastGetOptions = options
    if (state.getErrorName) throw makeError(state.getErrorName)
    if (state.returnNullCredential) return null
    if (state.credentialType !== 'public-key')
      return { type: state.credentialType }
    return buildCredential()
  }

  const setCredentialMethod = (name, fn) => {
    const creds = navigator.credentials
    try {
      creds[name] = fn
      return
    } catch {
      try {
        Object.defineProperty(creds, name, { value: fn, configurable: true })
      } catch {
        // Ignore if the runtime forbids stubbing.
      }
    }
  }

  if (navigator.credentials) {
    setCredentialMethod('create', create)
    setCredentialMethod('get', get)
  } else {
    Object.defineProperty(navigator, 'credentials', {
      value: { create, get },
      configurable: true,
    })
  }

  const MockPublicKeyCredential = class {}
  let pkc = globalThis.PublicKeyCredential

  try {
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      value: MockPublicKeyCredential,
      configurable: true,
      writable: true,
    })
    pkc = MockPublicKeyCredential
  } catch {
    if (!pkc) pkc = MockPublicKeyCredential
  }

  const setPkcMethod = (name, fn) => {
    try {
      pkc[name] = fn
      return
    } catch {
      try {
        Object.defineProperty(pkc, name, { value: fn, configurable: true })
      } catch {
        // Ignore if the runtime forbids stubbing.
      }
    }
  }

  setPkcMethod(
    'isUserVerifyingPlatformAuthenticatorAvailable',
    async () => state.uvAvailable
  )

  globalThis.__zkcState = state
}

const setState = async (page, patch) => {
  await page.evaluate((next) => {
    const target = globalThis.__zkcState ?? (globalThis.__zkcState = {})
    Object.assign(target, next)
  }, patch)
}

const runRegister = async (
  page,
  displayName = 'User',
  attachment = 'platform'
) =>
  page.evaluate(
    async ({ displayName, attachment }) => {
      const api =
        globalThis.ZKCredentials ??
        globalThis.ZKCredentialsBundle?.ZKCredentials
      try {
        await api.registerCredential(displayName, attachment)
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          code: error?.code ?? null,
          name: error?.name ?? null,
          message: error?.message ?? null,
        }
      }
    },
    { displayName, attachment }
  )

const runDiscover = async (page) =>
  page.evaluate(async () => {
    const api =
      globalThis.ZKCredentials ?? globalThis.ZKCredentialsBundle?.ZKCredentials
    try {
      const result = await api.discoverCredential()
      return {
        ok: true,
        id: result.id,
        cipherJwk: result.cipherJwk,
        hmacJwk: result.hmacJwk,
      }
    } catch (error) {
      return {
        ok: false,
        code: error?.code ?? null,
        name: error?.name ?? null,
        message: error?.message ?? null,
      }
    }
  })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installMocks)
  await page.goto('/')
})

test.describe('ZKCredentials.registerCredential', () => {
  test('returns unsupported when UV is unavailable', async ({ page }) => {
    await setState(page, { uvAvailable: false })
    const result = await runRegister(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('unsupported')
  })

  test('allows cross-platform without UV', async ({ page }) => {
    await setState(page, { uvAvailable: false })
    const result = await runRegister(page, 'User', 'cross-platform')
    expect(result.ok).toBe(true)
  })

  test('maps AbortError to aborted', async ({ page }) => {
    await setState(page, { createErrorName: 'AbortError' })
    const result = await runRegister(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('aborted')
  })

  test('maps NotAllowedError to user-denied', async ({ page }) => {
    await setState(page, { createErrorName: 'NotAllowedError' })
    const result = await runRegister(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('user-denied')
  })

  test('maps NotSupportedError to unsupported', async ({ page }) => {
    await setState(page, { createErrorName: 'NotSupportedError' })
    const result = await runRegister(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('unsupported')
  })

  test('maps SecurityError to unsupported', async ({ page }) => {
    await setState(page, { createErrorName: 'SecurityError' })
    const result = await runRegister(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('unsupported')
  })

  test('passes expected create options', async ({ page }) => {
    const result = await runRegister(page, 'Alice', 'platform')
    expect(result.ok).toBe(true)

    const details = await page.evaluate(() => {
      const state = globalThis.__zkcState
      const { publicKey } = state.lastCreateOptions
      return {
        rpId: publicKey.rp.id,
        rpName: publicKey.rp.name,
        userName: publicKey.user.name,
        userDisplayName: publicKey.user.displayName,
        userIdLength: publicKey.user.id.byteLength ?? publicKey.user.id.length,
        challengeLength:
          publicKey.challenge.byteLength ?? publicKey.challenge.length,
        attachment: publicKey.authenticatorSelection.authenticatorAttachment,
        residentKey: publicKey.authenticatorSelection.residentKey,
        userVerification: publicKey.authenticatorSelection.userVerification,
        timeout: publicKey.timeout,
        attestation: publicKey.attestation,
        algs: publicKey.pubKeyCredParams.map((item) => item.alg),
        prfFirstLength: publicKey.extensions?.prf?.eval?.first?.byteLength ?? 0,
        prfSecondLength:
          publicKey.extensions?.prf?.eval?.second?.byteLength ?? 0,
      }
    })

    expect(details.rpId).toBeTruthy()
    expect(details.rpName).toBeTruthy()
    expect(details.userName).toBe('Alice')
    expect(details.userDisplayName).toBe('Alice')
    expect(details.userIdLength).toBe(32)
    expect(details.challengeLength).toBe(32)
    expect(details.attachment).toBe('platform')
    expect(details.residentKey).toBe('required')
    expect(details.userVerification).toBe('required')
    expect(details.timeout).toBe(60_000)
    expect(details.attestation).toBe('none')
    expect(details.algs).toEqual(expect.arrayContaining([-7, -257]))
    expect(details.prfFirstLength).toBeGreaterThan(0)
    expect(details.prfSecondLength).toBeGreaterThan(0)
  })
})

test.describe('ZKCredentials.discoverCredential', () => {
  test('maps AbortError to aborted', async ({ page }) => {
    await setState(page, { getErrorName: 'AbortError' })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('aborted')
  })

  test('maps NotAllowedError to user-denied', async ({ page }) => {
    await setState(page, { getErrorName: 'NotAllowedError' })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('user-denied')
  })

  test('maps NotSupportedError to unsupported', async ({ page }) => {
    await setState(page, { getErrorName: 'NotSupportedError' })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('unsupported')
  })

  test('maps SecurityError to unsupported', async ({ page }) => {
    await setState(page, { getErrorName: 'SecurityError' })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('unsupported')
  })

  test('returns no-credential when get returns null', async ({ page }) => {
    await setState(page, { returnNullCredential: true })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('no-credential')
  })

  test('returns no-credential when type is not public-key', async ({
    page,
  }) => {
    await setState(page, { credentialType: 'password' })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('no-credential')
  })

  test('returns prf-unavailable when results are missing', async ({ page }) => {
    await setState(page, { prfResultsMissing: true })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('prf-unavailable')
  })

  test('returns prf-unavailable when results are incomplete', async ({
    page,
  }) => {
    await setState(page, { prfResultsPartial: true })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('prf-unavailable')
  })

  test('returns key-derivation-failed when results are invalid', async ({
    page,
  }) => {
    await setState(page, { prfResultsInvalid: true })
    const result = await runDiscover(page)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('key-derivation-failed')
  })

  test('returns derived id and keys', async ({ page }) => {
    const result = await runDiscover(page)
    expect(result.ok).toBe(true)
    expect(result.id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(result.cipherJwk.kty).toBe('oct')
    expect(result.hmacJwk.kty).toBe('oct')
    expect(result.cipherJwk.key_ops).toEqual(
      expect.arrayContaining(['encrypt', 'decrypt'])
    )
    expect(result.hmacJwk.key_ops).toEqual(
      expect.arrayContaining(['sign', 'verify'])
    )
  })

  test('passes expected get options', async ({ page }) => {
    const result = await runDiscover(page)
    expect(result.ok).toBe(true)

    const details = await page.evaluate(() => {
      const state = globalThis.__zkcState
      const { publicKey } = state.lastGetOptions
      return {
        rpId: publicKey.rpId,
        allowCredentialsLength: publicKey.allowCredentials.length,
        userVerification: publicKey.userVerification,
        timeout: publicKey.timeout,
        mediation: state.lastGetOptions.mediation,
        prfFirstLength: publicKey.extensions?.prf?.eval?.first?.byteLength ?? 0,
        prfSecondLength:
          publicKey.extensions?.prf?.eval?.second?.byteLength ?? 0,
      }
    })

    expect(details.rpId).toBeTruthy()
    expect(details.allowCredentialsLength).toBe(0)
    expect(details.userVerification).toBe('required')
    expect(details.timeout).toBe(60_000)
    expect(details.mediation).toBe('required')
    expect(details.prfFirstLength).toBeGreaterThan(0)
    expect(details.prfSecondLength).toBeGreaterThan(0)
  })
})
