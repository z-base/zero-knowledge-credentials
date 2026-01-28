import { toUint8Array, toBufferSource } from '@z-base/bytecodec'
import {
  type HMACJWK,
  deriveHMACKey,
  type CipherJWK,
  deriveCipherKey,
} from '@z-base/cryptosuite'
import { ZKCredentialError } from './errors.js'

export type RootKeys = { hmacJwk: HMACJWK; cipherJwk: CipherJWK }

export async function fromPRF(
  prfResults: AuthenticationExtensionsPRFOutputs['results'] | undefined
): Promise<RootKeys | false> {
  if (!prfResults) return false

  const { first, second } = prfResults
  if (!first || !second)
    throw new ZKCredentialError(
      'prf-unavailable',
      'One or more prf extensions results are missing'
    )
  if (!crypto?.subtle)
    throw new ZKCredentialError(
      'unsupported',
      'Web Crypto SubtleCrypto is not available'
    )

  const firstHash = await crypto.subtle.digest('SHA-256', toBufferSource(first))
  const secondHash = await crypto.subtle.digest(
    'SHA-256',
    toBufferSource(second)
  )

  const [hmacJwk, cipherJwk] = await Promise.all([
    deriveHMACKey(toUint8Array(firstHash)),
    deriveCipherKey(toUint8Array(secondHash)),
  ])

  return { hmacJwk, cipherJwk }
}
