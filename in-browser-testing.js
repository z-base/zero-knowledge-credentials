// node_modules/bytecodec/dist/fromBase64UrlString/index.js
function fromBase64UrlString(base64UrlString) {
  const base64String = toBase64String(base64UrlString);
  return decodeBase64(base64String);
}
function toBase64String(base64UrlString) {
  let base64String = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64String.length & 3;
  if (mod === 2) base64String += "==";
  else if (mod === 3) base64String += "=";
  else if (mod !== 0) throw new Error("Invalid base64url length");
  return base64String;
}
function decodeBase64(base64String) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(base64String, "base64"));
  if (typeof atob !== "function")
    throw new Error("No base64 decoder available in this environment.");
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index++)
    bytes[index] = binaryString.charCodeAt(index);
  return bytes;
}

// node_modules/bytecodec/dist/0-HELPERS/index.js
function isSharedArrayBuffer(buffer) {
  return (
    typeof SharedArrayBuffer !== "undefined" &&
    buffer instanceof SharedArrayBuffer
  );
}
function asArrayBufferView(view) {
  return view;
}
function normalizeToUint8Array(input) {
  if (input instanceof Uint8Array)
    return asArrayBufferView(
      isSharedArrayBuffer(input.buffer) ? new Uint8Array(input) : input,
    );
  if (input instanceof ArrayBuffer)
    return asArrayBufferView(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) {
    const view = new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength,
    );
    return asArrayBufferView(
      isSharedArrayBuffer(view.buffer) ? new Uint8Array(view) : view,
    );
  }
  if (Array.isArray(input)) return asArrayBufferView(new Uint8Array(input));
  throw new TypeError(
    "Expected a Uint8Array, ArrayBuffer, ArrayBufferView, or number[]",
  );
}
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
var textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function isNodeRuntime() {
  return typeof process !== "undefined" && !!process.versions?.node;
}

// node_modules/bytecodec/dist/toBase64UrlString/index.js
var chunkSize = 32768;
function toBase64UrlString(bytes) {
  const view = normalizeToUint8Array(bytes);
  const base64 = encodeBase64(view);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function encodeBase64(bytes) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return Buffer.from(bytes).toString("base64");
  let binaryString = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    let chunkString = "";
    for (let index = offset; index < end; index++) {
      chunkString += String.fromCharCode(bytes[index]);
    }
    binaryString += chunkString;
  }
  if (typeof btoa !== "function")
    throw new Error("No base64 encoder available in this environment.");
  return btoa(binaryString);
}

// node_modules/bytecodec/dist/fromString/index.js
function fromString(text) {
  if (typeof text !== "string")
    throw new TypeError("fromString expects a string input");
  if (textEncoder) return textEncoder.encode(text);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(text, "utf8"));
  throw new Error("No UTF-8 encoder available in this environment.");
}

// node_modules/bytecodec/dist/toString/index.js
function toString(bytes) {
  const view = normalizeToUint8Array(bytes);
  if (textDecoder) return textDecoder.decode(view);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return Buffer.from(view).toString("utf8");
  throw new Error("No UTF-8 decoder available in this environment.");
}

// node_modules/bytecodec/dist/fromJSON/index.js
function fromJSON(value) {
  try {
    return fromString(JSON.stringify(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`fromJSON failed to stringify value: ${message}`);
  }
}

// node_modules/bytecodec/dist/toJSON/index.js
function toJSON(input) {
  const jsonString = typeof input === "string" ? input : toString(input);
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`toJSON failed to parse value: ${message}`);
  }
}

// node_modules/bytecodec/dist/toCompressed/index.js
async function toCompressed(bytes) {
  const view = normalizeToUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gzipSync } = await import("node:zlib");
    return normalizeToUint8Array(gzipSync(view));
  }
  if (typeof CompressionStream === "undefined")
    throw new Error("gzip compression not available in this environment.");
  return compressWithStream(view, "gzip");
}
async function compressWithStream(bytes, format) {
  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const arrayBuffer = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// node_modules/bytecodec/dist/fromCompressed/index.js
async function fromCompressed(bytes) {
  const view = normalizeToUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gunzipSync } = await import("node:zlib");
    return normalizeToUint8Array(gunzipSync(view));
  }
  if (typeof DecompressionStream === "undefined")
    throw new Error("gzip decompression not available in this environment.");
  return decompressWithStream(view, "gzip");
}
async function decompressWithStream(bytes, format) {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const arrayBuffer = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// node_modules/bytecodec/dist/concat/index.js
function concat(sources) {
  if (!Array.isArray(sources))
    throw new TypeError("concat expects an array of ByteSource items");
  if (sources.length === 0) return new Uint8Array(0);
  const arrays = sources.map((source, index) => {
    try {
      return normalizeToUint8Array(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TypeError(
        `concat failed to normalize input at index ${index}: ${message}`,
      );
    }
  });
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    if (array.length === 0) continue;
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

// node_modules/bytecodec/dist/equals/index.js
function equals(x, y) {
  const a = normalizeToUint8Array(x);
  const b = normalizeToUint8Array(y);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}

// node_modules/bytecodec/dist/toBufferSource/index.js
function toBufferSource(bytes) {
  return normalizeToUint8Array(bytes);
}

// node_modules/bytecodec/dist/index.js
var Bytes = class {
  static fromBase64UrlString(base64UrlString) {
    return fromBase64UrlString(base64UrlString);
  }
  static toBase64UrlString(bytes) {
    return toBase64UrlString(bytes);
  }
  static fromString(text) {
    return fromString(text);
  }
  static toString(bytes) {
    return toString(bytes);
  }
  static toJSON(bytes) {
    return toJSON(bytes);
  }
  static fromJSON(value) {
    return fromJSON(value);
  }
  static toCompressed(bytes) {
    return toCompressed(bytes);
  }
  static fromCompressed(bytes) {
    return fromCompressed(bytes);
  }
  static concat(sources) {
    return concat(sources);
  }
  static equals(a, b) {
    return equals(a, b);
  }
  static toBufferSource(bytes) {
    return toBufferSource(bytes);
  }
  static toUint8Array(bytes) {
    return normalizeToUint8Array(bytes);
  }
};

// node_modules/zeyra/dist/deriveRootKeys/deriveCipherKey.js
async function deriveCipherKey(second) {
  const key = await crypto.subtle.importKey(
    "raw",
    second,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
  return await crypto.subtle.exportKey("jwk", key);
}

// node_modules/zeyra/dist/deriveRootKeys/deriveHmacKey.js
async function deriveHmacKey(first) {
  const key = await crypto.subtle.importKey(
    "raw",
    first,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  return await crypto.subtle.exportKey("jwk", key);
}

// node_modules/zeyra/dist/deriveRootKeys/index.js
function isArrayBuffer(value) {
  return value instanceof ArrayBuffer;
}
async function deriveRootKeys(prfResults) {
  if (!prfResults) return false;
  const { first, second } = prfResults;
  if (!isArrayBuffer(first) || !isArrayBuffer(second)) return false;
  const firstHash = await crypto.subtle.digest("SHA-256", first);
  const secondHash = await crypto.subtle.digest("SHA-256", second);
  const [hmacJwk, cipherJwk] = await Promise.all([
    deriveHmacKey(firstHash),
    deriveCipherKey(secondHash),
  ]);
  return { hmacJwk, cipherJwk };
}

// dist/ZKCredentials/class.js
var ZKCredentialError = class extends Error {
  code;
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
};
var ZKCredentials = class {
  static #timeout = 6e4;
  static #mediation = "required";
  static #userVerification = "required";
  static #prfInput1 = Bytes.toBufferSource(
    Bytes.fromString("credential-hmac-key-seed"),
  );
  static #prfInput2 = Bytes.toBufferSource(
    Bytes.fromString("credential-cipher-key-seed"),
  );
  static async #assertSupported() {
    if (typeof window === "undefined")
      throw new ZKCredentialError("unsupported");
    if (!("PublicKeyCredential" in window))
      throw new ZKCredentialError("unsupported");
    if (!navigator.credentials) throw new ZKCredentialError("unsupported");
    if (
      typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      "function"
    ) {
      throw new ZKCredentialError("unsupported");
    }
    const uv =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!uv) throw new ZKCredentialError("unsupported");
    const pcm = PublicKeyCredential.isConditionalMediationAvailable;
    if (typeof pcm === "function" && !(await pcm())) {
      throw new ZKCredentialError("unsupported");
    }
  }
  static async registerCredential(
    usersDisplayName,
    authenticatorAttachment,
    signal,
  ) {
    try {
      await this.#assertSupported();
    } catch {
      return this.ifIsNotSupported();
    }
    const publicKey = {
      rp: { id: window.location.hostname, name: window.location.host },
      user: {
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: usersDisplayName,
        displayName: usersDisplayName,
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment,
        residentKey: "required",
        userVerification: this.#userVerification,
      },
      timeout: this.#timeout,
      attestation: "none",
      extensions: {
        prf: {
          eval: {
            first: this.#prfInput1,
            second: this.#prfInput2,
          },
        },
      },
    };
    try {
      await navigator.credentials.create({ publicKey, signal });
    } catch (error) {
      if (error?.name === "AbortError") throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      throw error;
    }
  }
  static async discoverCredential(signal) {
    try {
      await this.#assertSupported();
    } catch {
      return this.ifIsNotSupported();
    }
    let credential;
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
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      throw error;
    }
    if (!credential || credential.type !== "public-key")
      throw new ZKCredentialError("no-credential");
    const typed = credential;
    const prf = typed.getClientExtensionResults().prf;
    if (!prf?.results) throw new ZKCredentialError("prf-unavailable");
    let keys;
    try {
      keys = await deriveRootKeys(prf.results);
    } catch {
      throw new ZKCredentialError("key-derivation-failed");
    }
    if (!keys) throw new ZKCredentialError("key-derivation-failed");
    const idHash = await crypto.subtle.digest("SHA-256", typed.rawId);
    const id = Bytes.toBase64UrlString(idHash);
    return {
      id,
      hmacJwk: keys.hmacJwk,
      cipherJwk: keys.cipherJwk,
    };
  }
  static ifIsNotSupported = () => {
    throw new ZKCredentialError(
      "unsupported",
      "WebAuthn capability not supported on this device",
    );
  };
};
export { ZKCredentials };
