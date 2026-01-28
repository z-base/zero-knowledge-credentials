import { toBufferSource, fromString, toUint8Array } from '@z-base/bytecodec'
import {
  type OpaqueIdentifier,
  type HMACJWK,
  type CipherJWK,
  generateOID,
  generateHMACKey,
  generateCipherKey,
  deriveOID,
} from '@z-base/cryptosuite'
import { ZKCredentialError } from './errors.js'
import { fromPRF } from './fromPRF.js'

export type ZKCredential = {
  id: OpaqueIdentifier
  hmacJwk: HMACJWK
  cipherJwk: CipherJWK
}

export class ZKCredentials {
  static readonly #timeout = 60_000
  static readonly #mediation: CredentialRequestOptions['mediation'] = 'required'
  static readonly #userVerification: AuthenticatorSelectionCriteria['userVerification'] =
    'required'

  static readonly #prfInput1: BufferSource = toBufferSource(
    fromString('credential-hmac-key-seed')
  )
  static readonly #prfInput2: BufferSource = toBufferSource(
    fromString('credential-cipher-key-seed')
  )

  static async #assertSupported(options?: {
    requirePlatformUV?: boolean
  }): Promise<void> {
    if (typeof window === 'undefined')
      throw new ZKCredentialError('unsupported')
    if (!('PublicKeyCredential' in window))
      throw new ZKCredentialError('unsupported')
    if (!navigator.credentials) throw new ZKCredentialError('unsupported')
    if (!window.crypto || !window.crypto.subtle)
      throw new ZKCredentialError('unsupported')

    if (options?.requirePlatformUV) {
      if (
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
        'function'
      ) {
        throw new ZKCredentialError('unsupported')
      }

      const uv =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      if (!uv) throw new ZKCredentialError('unsupported')
    }
  }

  static async registerCredential(
    usersDisplayName: string,
    authenticatorAttachment: AuthenticatorAttachment,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      await this.#assertSupported({
        requirePlatformUV: authenticatorAttachment === 'platform',
      })
    } catch {
      return this.onNotSupported()
    }

    const publicKey: PublicKeyCredentialCreationOptions = {
      rp: { id: window.location.hostname, name: window.location.host },
      user: {
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: usersDisplayName,
        displayName: usersDisplayName,
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment,
        residentKey: 'required',
        userVerification: this.#userVerification,
      },
      timeout: this.#timeout,
      attestation: 'none',
      extensions: {
        prf: {
          eval: {
            first: this.#prfInput1,
            second: this.#prfInput2,
          },
        },
      },
    }

    try {
      await navigator.credentials.create({ publicKey, signal })
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new ZKCredentialError('aborted')
      if (error?.name === 'NotAllowedError')
        throw new ZKCredentialError('user-denied')
      if (
        error?.name === 'NotSupportedError' ||
        error?.name === 'SecurityError'
      ) {
        throw new ZKCredentialError('unsupported')
      }
      throw error
    }
  }

  static async discoverCredential(signal?: AbortSignal): Promise<ZKCredential> {
    try {
      await this.#assertSupported()
    } catch {
      return this.onNotSupported()
    }

    let credential: Credential | null
    try {
      credential = await navigator.credentials.get({
        publicKey: {
          rpId: window.location.hostname,
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [],
          userVerification: this.#userVerification,
          timeout: this.#timeout,
          extensions: {
            prf: {
              eval: {
                first: this.#prfInput1,
                second: this.#prfInput2,
              },
            },
          },
        },
        mediation: this.#mediation,
        signal,
      })
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new ZKCredentialError('aborted')
      if (error?.name === 'NotAllowedError')
        throw new ZKCredentialError('user-denied')
      if (
        error?.name === 'NotSupportedError' ||
        error?.name === 'SecurityError'
      ) {
        throw new ZKCredentialError('unsupported')
      }
      throw error
    }

    if (!credential || credential.type !== 'public-key')
      throw new ZKCredentialError('no-credential')

    const typed = credential as PublicKeyCredential
    const prf = typed.getClientExtensionResults().prf
    if (!prf?.results) throw new ZKCredentialError('prf-unavailable')

    let keys
    try {
      keys = await fromPRF(prf.results)
    } catch (error) {
      if (error instanceof ZKCredentialError) throw error
      throw new ZKCredentialError('key-derivation-failed')
    }
    if (!keys) throw new ZKCredentialError('key-derivation-failed')

    const id = await deriveOID(toUint8Array(typed.rawId))

    return {
      id,
      hmacJwk: keys.hmacJwk,
      cipherJwk: keys.cipherJwk,
    }
  }

  static async generateCredentials(): Promise<ZKCredential> {
    return {
      id: await generateOID(),
      hmacJwk: await generateHMACKey(),
      cipherJwk: await generateCipherKey(),
    }
  }

  static onNotSupported: () => never = () => {
    throw new ZKCredentialError(
      'unsupported',
      '{@z-base/zero-knowledge-credentials} WebAuthn capability not supported on this host'
    )
  }
}
