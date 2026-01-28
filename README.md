[![npm version](https://img.shields.io/npm/v/@z-base/zero-knowledge-credentials)](https://www.npmjs.com/package/@z-base/zero-knowledge-credentials)
[![CI](https://github.com/z-base/zero-knowledge-credentials/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/z-base/zero-knowledge-credentials/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/z-base/zero-knowledge-credentials/branch/master/graph/badge.svg)](https://codecov.io/gh/z-base/zero-knowledge-credentials)
[![license](https://img.shields.io/npm/l/@z-base/zero-knowledge-credentials)](LICENSE)

# zero-knowledge-credentials

Client-side WebAuthn credential discovery for strict zero-knowledge apps. Deterministically derive a routing identifier and cryptographic root keys from a user-verifying authenticator, without accounts, identifiers, or server-side state.

## Compatibility

- Runtimes: modern browsers with WebAuthn + PRF extension + user verification.
- Module format: ESM-only (no CJS build).
- Required globals / APIs: `window`, `navigator.credentials`, `PublicKeyCredential`, PRF extension, `crypto.subtle`, `crypto.getRandomValues`.
- TypeScript: bundled types.

## Goals

- Enable strict local-first zero-knowledge for browsers.
- Deterministic, runtime-only derivation of an opaque ID and root keys.
- No storage, no networking, no server-side requirements.
- Explicit failure modes with stable error codes.

## Installation

```sh
npm install @z-base/zero-knowledge-credentials
# or
pnpm add @z-base/zero-knowledge-credentials
# or
yarn add @z-base/zero-knowledge-credentials
```

## Usage

**These give a general idea and MUST NOT be interpreted as a full solution.**

### Register a credential

```ts
import {
  ZKCredentials,
  type ZKCredential,
  type ZKCredentialErrorCode,
} from '@z-base/zero-knowledge-credentials'

await ZKCredentials.registerCredential(
  'User display name',
  'platform' // or 'cross-platform'
)
```

### Discover a credential

```ts
import { Bytes } from '@z-base/bytecodec'
import { Cryptosuite } from '@z-base/cryptosuite'
import { ZKCredentials } from '@z-base/zero-knowledge-credentials'

const root = await ZKCredentials.discoverCredential()

const id = root.id // routing identifier / OpaqueIdentifier
const hmacJwk = root.hmacJwk // HMAC root key / HMACJWK
const cipherJwk = root.cipherJwk // AES-GCM root key / CipherJWK

const cache = await caches.open('opaque-blobs')

let artifact = await cache.match(id) // {iv, ciphertext}

if (!artifact) {
  const challengeRaw = await fetch(`/api/v1/artifact/${id}/challenge`)
  const challengeText = await challengeRaw.text()
  const challengeBytes = Bytes.fromBase64UrlString(challengeText)
  const signature = await Cryptosuite.hmac.sign(hmacJwk, challengeBytes)
  const raw = await fetch(`/api/v1/artifact/${id}`, {
    headers: {
      Authorization: Bytes.toBase64UrlString(signature),
    },
  })
  artifact = await raw.json() // {iv, ciphertext}
}

const accountCredentials = await Cryptosuite.cipher.decrypt(cipherJwk, artifact)

// const {id, hmacJwk, cipherJwk} = accountCredentials
// repeat...
// const {profileCredentials, workspaceCredentials}  = resourceCredentials
```

### Generate credentials

```ts
import { Bytes } from '@z-base/bytecodec'
import { Cryptosuite } from '@z-base/cryptosuite'
import { ZKCredentials } from '@z-base/zero-knowledge-credentials'

const profile = {
  name: 'Bob',
  preferences: {
    theme: 'dark',
  },
}

const credentials = await ZKCredentials.generateCredentials()

const id = credentials.id // resource routing identifier / OpaqueIdentifier
const hmacJwk = credentials.hmacJwk // HMAC resource key / HMACJWK
const cipherJwk = credentials.cipherJwk // AES-GCM resource key / CipherJWK

const profileBytes = Bytes.fromJSON(profile)
const artifact = await Cryptosuite.cipher.encrypt(cipherJwk, profileBytes)
fetch(
  `/api/v1/artifact/${id}`,
  JSON.stringify({
    verifier: hmacJwk,
    state: {
      iv: Bytes.toBase64UrlString(artifact.iv),
      ciphertext: Bytes.toBase64UrlString(artifact.ciphertext),
    },
  }),
  {
    method: 'POST',
  }
)
```

## Runtime behavior

### Browsers

Uses WebAuthn PRF outputs to derive:

- `id` (SHA-256 -> base64url of `rawId`)
- `cipherJwk` (AES-GCM)
- `hmacJwk` (HMAC-SHA256)

### Validation & errors

All failures are explicit and semantic. Errors are instances of `ZKCredentialError` with a stable `code`:

- `unsupported`
- `aborted`
- `user-denied`
- `no-credential`
- `prf-unavailable`
- `key-derivation-failed`

## Tests

Suite: unit + integration (Node), E2E (Playwright)
Matrix: Chromium / Firefox / WebKit + mobile emulation (Pixel 5, iPhone 12)
Coverage: c8 — 100% statements/branches/functions/lines (dist via source maps)

## Benchmarks

How it was run: `npm run bench`
Environment: Node v22.14.0 (win32 x64)
Results:

| Benchmark           | Result                             |
| ------------------- | ---------------------------------- |
| fromPRF             | 5,224 ops/s (0.191 ms/op, 200 ops) |
| generateCredentials | 5,825 ops/s (0.172 ms/op, 50 ops)  |

Results vary by machine.

## License

MIT
