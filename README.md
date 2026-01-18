# zero-knowledge-credentials

Client-side WebAuthn credential discovery for **strict zero-knowledge applications**.  
This package deterministically derives routing and cryptographic root keys from a **user-verifying authenticator**, without accounts, identifiers, or server-side state.

If the correct authenticator is present and the user verifies, state becomes discoverable.  
If not, nothing exists.

---

## Core idea

There is no account lookup.

There is no user database.

Application state is **discovered**, not queried — and only by possessing the correct cryptographic seed derived from WebAuthn PRF.

---

## What this package provides

A single discovered credential yields:

- **`id`**  
  A stable, opaque routing identifier derived from the credential’s `rawId`  
  (`SHA-256 -> base64url`).  
  Used to route encrypted state, backups, or envelopes.

- **`cipherJwk`**  
  AES-GCM root key derived from WebAuthn PRF.  
  Used to encrypt application state.

- **`hmacJwk`**  
  HMAC-SHA256 root key derived from WebAuthn PRF.  
  Used to verify integrity, linkage, or authorization.

These values are **derived at runtime**, never stored, never synced, and never reconstructible without the authenticator.

---

## Mental model

This package is intentionally small. It handles exactly one concern:

> “Given a verified human on a device, can we deterministically derive the same cryptographic roots again?”

Typical flow:

1. Register a resident, user-verifying credential (once).
2. Discover the credential later via user verification.
3. Use the derived `id` to locate encrypted state.
4. Use the derived keys to decrypt and verify that state.
5. Recursively discover further state or capabilities.

No index. No enumeration. No implicit trust.

---

## Compatibility

- Requires **WebAuthn with user verification**
  - Platform authenticators (passkeys / built-in)
- Requires **WebAuthn PRF extension**
- Browser environment only
- ESM only

If any required capability is missing, the API fails explicitly with a typed error.

---

## Installation

```sh
npm install zero-knowledge-credentials
# or
pnpm add zero-knowledge-credentials
# or
yarn add zero-knowledge-credentials
```

---

## Registering a credential

Creates a resident, user-verifying credential with PRF enabled.

```ts
import { ZKCredentials } from "zero-knowledge-credentials";

await ZKCredentials.registerCredential(
  "User display name",
  "platform", // or "cross-platform"
);
```

Nothing is returned.
Nothing is persisted by this package.

---

## Discovering a credential

Performs user verification and derives root keys.

```ts
import { ZKCredentials } from "zero-knowledge-credentials";

const zk = await ZKCredentials.discoverCredential();

zk.id; // routing identifier
zk.cipherJwk; // AES-GCM root key
zk.hmacJwk; // HMAC root key
```

If discovery fails, a typed error is thrown.

---

## Error model

All failures are explicit and semantic:

- `unsupported` — WebAuthn / PRF / user-verification unavailable
- `aborted` — aborted via `AbortSignal`
- `user-denied` — user refused verification
- `no-credential` — no matching resident credential
- `prf-unavailable` — PRF extension missing or denied
- `key-derivation-failed` — PRF output invalid or unusable

Errors are instances of `ZKCredentialError` with a stable `code`.

```ts
import { ZKCredentials, ZKCredentialError } from "zero-knowledge-credentials";

try {
  await ZKCredentials.discoverCredential();
} catch (error) {
  if (error instanceof ZKCredentialError) {
    console.log(error.code);
  }
}
```

---

## What this package does _not_ do

- No encryption helpers
- No storage
- No networking
- No recovery flows
- No account abstraction

Those belong to higher layers.

This package is deliberately a **root primitive**, not a framework.

---

## Intended use

Designed for systems where:

- servers are blind relays
- state is encrypted end-to-end
- authority lives with the user, not infrastructure
- application graphs are discovered, not listed

Typical downstream integrations include encrypted local-first state, zero-knowledge backups, and capability-based authorization systems.

---

## Development

```sh
npm run build
```

```sh
npm run test
# first time only:
npx playwright install
```

```sh
npm run build:demo
```

---

## License

MIT
