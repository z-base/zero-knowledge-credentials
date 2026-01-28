// node_modules/@z-base/bytecodec/dist/.errors/class.js
var BytecodecError = class extends Error {
  code;
  constructor(code, message) {
    const detail = message ?? code;
    super(`{bytecodec} ${detail}`);
    this.code = code;
    this.name = "BytecodecError";
  }
};

// node_modules/@z-base/bytecodec/dist/fromBase64UrlString/index.js
function fromBase64UrlString(base64UrlString) {
  const base64String = toBase64String(base64UrlString);
  return decodeBase64(base64String);
}
function toBase64String(base64UrlString) {
  let base64String = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64String.length & 3;
  if (mod === 2)
    base64String += "==";
  else if (mod === 3)
    base64String += "=";
  else if (mod !== 0)
    throw new BytecodecError("BASE64URL_INVALID_LENGTH", "Invalid base64url length");
  return base64String;
}
function decodeBase64(base64String) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(base64String, "base64"));
  if (typeof atob !== "function")
    throw new BytecodecError("BASE64_DECODER_UNAVAILABLE", "No base64 decoder available in this environment.");
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index++)
    bytes[index] = binaryString.charCodeAt(index);
  return bytes;
}

// node_modules/@z-base/bytecodec/dist/toBase64UrlString/index.js
var chunkSize = 32768;
function toBase64UrlString(bytes) {
  const view = toUint8Array(bytes);
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
    throw new BytecodecError("BASE64_ENCODER_UNAVAILABLE", "No base64 encoder available in this environment.");
  return btoa(binaryString);
}

// node_modules/@z-base/bytecodec/dist/.helpers/index.js
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
var textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function isNodeRuntime() {
  return typeof process !== "undefined" && !!process.versions?.node;
}
function isSharedArrayBuffer(buffer) {
  return typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}

// node_modules/@z-base/bytecodec/dist/fromString/index.js
function fromString(text) {
  if (typeof text !== "string")
    throw new BytecodecError("STRING_INPUT_EXPECTED", "fromString expects a string input");
  if (textEncoder)
    return textEncoder.encode(text);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(text, "utf8"));
  throw new BytecodecError("UTF8_ENCODER_UNAVAILABLE", "No UTF-8 encoder available in this environment.");
}

// node_modules/@z-base/bytecodec/dist/toString/index.js
function toString(bytes) {
  const view = toUint8Array(bytes);
  if (textDecoder)
    return textDecoder.decode(view);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return Buffer.from(view).toString("utf8");
  throw new BytecodecError("UTF8_DECODER_UNAVAILABLE", "No UTF-8 decoder available in this environment.");
}

// node_modules/@z-base/bytecodec/dist/fromJSON/index.js
function fromJSON(value) {
  try {
    return fromString(JSON.stringify(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BytecodecError("JSON_STRINGIFY_FAILED", `fromJSON failed to stringify value: ${message}`);
  }
}

// node_modules/@z-base/bytecodec/dist/toJSON/index.js
function toJSON(input) {
  const jsonString = typeof input === "string" ? input : toString(input);
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BytecodecError("JSON_PARSE_FAILED", `toJSON failed to parse value: ${message}`);
  }
}

// node_modules/@z-base/bytecodec/dist/toCompressed/index.js
async function toCompressed(bytes) {
  const view = toUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gzip } = await import("node:zlib");
    const { promisify } = await import("node:util");
    const gzipAsync = promisify(gzip);
    const compressed = await gzipAsync(view);
    return toUint8Array(compressed);
  }
  if (typeof CompressionStream === "undefined")
    throw new BytecodecError("GZIP_COMPRESSION_UNAVAILABLE", "gzip compression not available in this environment.");
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

// node_modules/@z-base/bytecodec/dist/fromCompressed/index.js
async function fromCompressed(bytes) {
  const view = toUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gunzip } = await import("node:zlib");
    const { promisify } = await import("node:util");
    const gunzipAsync = promisify(gunzip);
    const decompressed = await gunzipAsync(view);
    return toUint8Array(decompressed);
  }
  if (typeof DecompressionStream === "undefined")
    throw new BytecodecError("GZIP_DECOMPRESSION_UNAVAILABLE", "gzip decompression not available in this environment.");
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

// node_modules/@z-base/bytecodec/dist/toBufferSource/index.js
function toBufferSource(bytes) {
  return toUint8Array(bytes);
}

// node_modules/@z-base/bytecodec/dist/toArrayBuffer/index.js
function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer)
    return bytes.slice(0);
  if (ArrayBuffer.isView(bytes)) {
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return isSharedArrayBuffer(view.buffer) ? view.slice().buffer : view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (Array.isArray(bytes))
    return new Uint8Array(bytes).buffer;
  throw new BytecodecError("BYTE_SOURCE_EXPECTED", "Expected a Uint8Array, ArrayBuffer, ArrayBufferView, or number[]");
}

// node_modules/@z-base/bytecodec/dist/toUint8Array/index.js
function toUint8Array(input) {
  if (input instanceof Uint8Array)
    return new Uint8Array(input);
  if (input instanceof ArrayBuffer)
    return new Uint8Array(input.slice(0));
  if (ArrayBuffer.isView(input)) {
    const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return new Uint8Array(view);
  }
  if (Array.isArray(input))
    return new Uint8Array(input);
  throw new BytecodecError("BYTE_SOURCE_EXPECTED", "Expected a Uint8Array, ArrayBuffer, ArrayBufferView, or number[]");
}

// node_modules/@z-base/bytecodec/dist/concat/index.js
function concat(sources) {
  if (!Array.isArray(sources))
    throw new BytecodecError("CONCAT_INVALID_INPUT", "concat expects an array of ByteSource items");
  if (sources.length === 0)
    return new Uint8Array(0);
  const arrays = sources.map((source, index) => {
    try {
      return toUint8Array(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BytecodecError("CONCAT_NORMALIZE_FAILED", `concat failed to normalize input at index ${index}: ${message}`);
    }
  });
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    if (array.length === 0)
      continue;
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}

// node_modules/@z-base/bytecodec/dist/equals/index.js
function equals(x, y) {
  const a = toUint8Array(x);
  const b = toUint8Array(y);
  if (a.byteLength !== b.byteLength)
    return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++)
    diff |= a[index] ^ b[index];
  return diff === 0;
}

// node_modules/@z-base/bytecodec/dist/index.js
var Bytes = class {
  /***/
  static fromBase64UrlString(base64UrlString) {
    return fromBase64UrlString(base64UrlString);
  }
  static toBase64UrlString(bytes) {
    return toBase64UrlString(bytes);
  }
  /***/
  static fromString(text) {
    return fromString(text);
  }
  static toString(bytes) {
    return toString(bytes);
  }
  /***/
  static toJSON(bytes) {
    return toJSON(bytes);
  }
  static fromJSON(value) {
    return fromJSON(value);
  }
  /***/
  static toCompressed(bytes) {
    return toCompressed(bytes);
  }
  static fromCompressed(bytes) {
    return fromCompressed(bytes);
  }
  /***/
  static toBufferSource(bytes) {
    return toBufferSource(bytes);
  }
  static toArrayBuffer(bytes) {
    return toArrayBuffer(bytes);
  }
  static toUint8Array(bytes) {
    return toUint8Array(bytes);
  }
  /***/
  static concat(sources) {
    return concat(sources);
  }
  static equals(a, b) {
    return equals(a, b);
  }
};

// node_modules/@z-base/cryptosuite/dist/.errors/class.js
var CryptosuiteError = class extends Error {
  code;
  constructor(code, message) {
    const detail = message ?? code;
    super(`{@z-base/cryptosuite} ${detail}`);
    this.code = code;
    this.name = "CryptosuiteError";
  }
};

// node_modules/@z-base/cryptosuite/dist/.helpers/assertCryptoAvailable.js
function assertCryptoAvailable(context = "crypto") {
  if (!globalThis.crypto) {
    throw new CryptosuiteError("CRYPTO_UNAVAILABLE", `${context}: Web Crypto API is unavailable.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertSubtleAvailable.js
function assertSubtleAvailable(context = "crypto.subtle") {
  assertCryptoAvailable(context);
  if (!globalThis.crypto.subtle) {
    throw new CryptosuiteError("SUBTLE_UNAVAILABLE", `${context}: SubtleCrypto is unavailable.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/.helpers/getBufferSourceLength.js
function getBufferSourceLength(source, context = "value") {
  if (source instanceof ArrayBuffer)
    return source.byteLength;
  if (source instanceof Uint8Array)
    return source.byteLength;
  throw new CryptosuiteError("BUFFER_SOURCE_EXPECTED", `${context}: expected a Uint8Array or ArrayBuffer.`);
}

// node_modules/@z-base/cryptosuite/dist/.helpers/shared.js
var BYTES_32 = 32;
var USE_SIG = "sig";
var USE_ENC = "enc";
var AES_GCM_ALG = "A256GCM";
var AES_GCM_USE = USE_ENC;
var AES_GCM_KEY_BYTES = BYTES_32;
var AES_GCM_KEY_OPS = ["encrypt", "decrypt"];
var AES_GCM_IV_BYTES = 12;
var ED25519_ALG = "EdDSA";
var ED25519_CURVE = "Ed25519";
var ED25519_USE = USE_SIG;
var ED25519_BYTES = BYTES_32;
var ED25519_PRIVATE_OPS = ["sign"];
var ED25519_PUBLIC_OPS = ["verify"];
var HMAC_ALG = "HS256";
var HMAC_USE = USE_SIG;
var HMAC_KEY_BYTES = BYTES_32;
var HMAC_KEY_OPS = ["sign", "verify"];
var RSA_OAEP_ALG = "RSA-OAEP-256";
var RSA_OAEP_USE = USE_ENC;
var RSA_MODULUS_BYTES = 512;
var RSA_PRIVATE_OPS = ["unwrapKey", "decrypt"];
var RSA_PUBLIC_OPS = ["wrapKey", "encrypt"];

// node_modules/@z-base/cryptosuite/dist/.helpers/assertRawAesGcm256Bytes.js
function assertRawAesGcm256Bytes(raw, context = "key material") {
  const length = getBufferSourceLength(raw, context);
  if (length !== AES_GCM_KEY_BYTES) {
    throw new CryptosuiteError("AES_GCM_RAW_LENGTH_INVALID", `${context}: expected 32 bytes (256-bit).`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Cipher/deriveCipherKey/index.js
async function deriveCipherKey(rawKey) {
  assertSubtleAvailable("deriveCipherKey");
  assertRawAesGcm256Bytes(rawKey, "deriveCipherKey");
  let key;
  try {
    key = await crypto.subtle.importKey("raw", toBufferSource(rawKey), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  } catch {
    throw new CryptosuiteError("AES_GCM_UNSUPPORTED", "deriveCipherKey: AES-GCM is not supported.");
  }
  return await crypto.subtle.exportKey("jwk", key);
}

// node_modules/@z-base/cryptosuite/dist/Cipher/generateCipherKey/index.js
async function generateCipherKey() {
  assertSubtleAvailable("generateCipherKey");
  let aesKey;
  try {
    aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  } catch {
    throw new CryptosuiteError("AES_GCM_UNSUPPORTED", "generateCipherKey: AES-GCM is not supported.");
  }
  return await crypto.subtle.exportKey("jwk", aesKey);
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertAesGcm256Key.js
function assertAesGcm256Key(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("AES_GCM_KEY_EXPECTED", `${context}: expected an AES-GCM JWK.`);
  }
  if (jwk.kty !== "oct") {
    throw new CryptosuiteError("AES_GCM_KEY_EXPECTED", `${context}: expected an octet JWK for AES-GCM.`);
  }
  if (jwk.alg && jwk.alg !== AES_GCM_ALG) {
    throw new CryptosuiteError("AES_GCM_ALG_INVALID", `${context}: expected alg ${AES_GCM_ALG}.`);
  }
  if (jwk.use && jwk.use !== AES_GCM_USE) {
    throw new CryptosuiteError("AES_GCM_USE_INVALID", `${context}: expected use ${AES_GCM_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("AES_GCM_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    for (const op of ops) {
      if (!AES_GCM_KEY_OPS.includes(op)) {
        throw new CryptosuiteError("AES_GCM_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
    for (const required of AES_GCM_KEY_OPS) {
      if (!ops.has(required)) {
        throw new CryptosuiteError("AES_GCM_KEY_OPS_INVALID", `${context}: key_ops must include ${required}.`);
      }
    }
  }
  if (typeof jwk.k !== "string") {
    throw new CryptosuiteError("AES_GCM_KEY_EXPECTED", `${context}: missing key material.`);
  }
  let keyBytes;
  try {
    keyBytes = fromBase64UrlString(jwk.k);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url key material.`);
  }
  if (keyBytes.byteLength !== AES_GCM_KEY_BYTES) {
    throw new CryptosuiteError("AES_GCM_KEY_SIZE_INVALID", `${context}: expected 256-bit key material.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertAesGcmIv96.js
function assertAesGcmIv96(iv, context = "iv") {
  const length = getBufferSourceLength(iv, context);
  if (length !== AES_GCM_IV_BYTES) {
    throw new CryptosuiteError("AES_GCM_IV_LENGTH_INVALID", `${context}: expected 12 bytes (96-bit).`);
  }
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertGetRandomValuesAvailable.js
function assertGetRandomValuesAvailable(context = "crypto.getRandomValues") {
  assertCryptoAvailable(context);
  if (typeof globalThis.crypto.getRandomValues !== "function") {
    throw new CryptosuiteError("GET_RANDOM_VALUES_UNAVAILABLE", `${context}: crypto.getRandomValues is unavailable.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Cipher/CipherAgent/class.js
var CipherAgent = class {
  keyPromise;
  constructor(cipherJwk) {
    assertAesGcm256Key(cipherJwk, "CipherAgent");
    assertSubtleAvailable("CipherAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", cipherJwk, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      } catch {
        throw new CryptosuiteError("AES_GCM_UNSUPPORTED", "CipherAgent: AES-GCM is not supported.");
      }
    })();
  }
  async encrypt(plaintext) {
    const key = await this.keyPromise;
    assertGetRandomValuesAvailable("CipherAgent.encrypt");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toBufferSource(plaintext));
    return { iv, ciphertext };
  }
  async decrypt({ iv, ciphertext }) {
    const key = await this.keyPromise;
    assertAesGcmIv96(iv, "CipherAgent.decrypt");
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, ciphertext);
    return new Uint8Array(plaintext);
  }
};

// node_modules/@z-base/cryptosuite/dist/Cipher/CipherCluster/class.js
var CipherCluster = class _CipherCluster {
  static #agents = /* @__PURE__ */ new WeakMap();
  static #loadAgent(cipherJwk) {
    const weakRef = _CipherCluster.#agents.get(cipherJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new CipherAgent(cipherJwk);
      _CipherCluster.#agents.set(cipherJwk, new WeakRef(agent));
    }
    return agent;
  }
  static async encrypt(cipherJwk, bytes) {
    const agent = _CipherCluster.#loadAgent(cipherJwk);
    return await agent.encrypt(bytes);
  }
  static async decrypt(cipherJwk, artifact) {
    const agent = _CipherCluster.#loadAgent(cipherJwk);
    return await agent.decrypt(artifact);
  }
};

// node_modules/@z-base/cryptosuite/dist/Exchange/generateExchangePair/index.js
async function generateExchangePair() {
  assertSubtleAvailable("generateExchangePair");
  let exchangePair;
  try {
    exchangePair = await crypto.subtle.generateKey({
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    }, true, ["wrapKey", "unwrapKey"]);
  } catch {
    throw new CryptosuiteError("RSA_OAEP_UNSUPPORTED", "generateExchangePair: RSA-OAEP (4096/SHA-256) is not supported.");
  }
  const wrapJwk = await crypto.subtle.exportKey("jwk", exchangePair.publicKey);
  const unwrapJwk = await crypto.subtle.exportKey("jwk", exchangePair.privateKey);
  return { wrapJwk, unwrapJwk };
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertRsaOaep4096PublicKey.js
function assertRsaOaep4096PublicKey(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("RSA_OAEP_PUBLIC_KEY_EXPECTED", `${context}: expected an RSA-OAEP public JWK.`);
  }
  if (jwk.kty !== "RSA") {
    throw new CryptosuiteError("RSA_OAEP_PUBLIC_KEY_EXPECTED", `${context}: expected kty RSA.`);
  }
  if (jwk.alg && jwk.alg !== RSA_OAEP_ALG) {
    throw new CryptosuiteError("RSA_OAEP_ALG_INVALID", `${context}: expected alg ${RSA_OAEP_ALG}.`);
  }
  if (jwk.use && jwk.use !== RSA_OAEP_USE) {
    throw new CryptosuiteError("RSA_OAEP_USE_INVALID", `${context}: expected use ${RSA_OAEP_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    if (!ops.has("wrapKey")) {
      throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: key_ops must include wrapKey.`);
    }
    for (const op of ops) {
      if (!RSA_PUBLIC_OPS.includes(op)) {
        throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
  }
  if (typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new CryptosuiteError("RSA_OAEP_PUBLIC_KEY_EXPECTED", `${context}: missing modulus or exponent.`);
  }
  if (typeof jwk.d === "string" || typeof jwk.p === "string" || typeof jwk.q === "string" || typeof jwk.dp === "string" || typeof jwk.dq === "string" || typeof jwk.qi === "string") {
    throw new CryptosuiteError("RSA_OAEP_PUBLIC_KEY_EXPECTED", `${context}: private parameters are not allowed.`);
  }
  let modulus;
  try {
    modulus = fromBase64UrlString(jwk.n);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url modulus.`);
  }
  if (modulus.byteLength !== RSA_MODULUS_BYTES) {
    throw new CryptosuiteError("RSA_OAEP_MODULUS_LENGTH_INVALID", `${context}: expected 4096-bit modulus.`);
  }
  let exponent;
  try {
    exponent = fromBase64UrlString(jwk.e);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url exponent.`);
  }
  let first = 0;
  while (first < exponent.length && exponent[first] === 0)
    first += 1;
  const remaining = exponent.length - first;
  if (remaining !== 3 || exponent[first] !== 1 || exponent[first + 1] !== 0 || exponent[first + 2] !== 1) {
    throw new CryptosuiteError("RSA_OAEP_EXPONENT_INVALID", `${context}: expected exponent 65537.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Exchange/WrapAgent/class.js
var WrapAgent = class {
  keyPromise;
  constructor(wrapJwk) {
    assertRsaOaep4096PublicKey(wrapJwk, "WrapAgent");
    assertSubtleAvailable("WrapAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", wrapJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["wrapKey"]);
      } catch {
        throw new CryptosuiteError("RSA_OAEP_UNSUPPORTED", "WrapAgent: RSA-OAEP (4096/SHA-256) is not supported.");
      }
    })();
  }
  async wrap(cipherJwk) {
    assertAesGcm256Key(cipherJwk, "WrapAgent.wrap");
    const wrappingKey = await this.keyPromise;
    let aesKey;
    try {
      aesKey = await crypto.subtle.importKey("jwk", cipherJwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
    } catch {
      throw new CryptosuiteError("AES_GCM_UNSUPPORTED", "WrapAgent.wrap: AES-GCM is not supported.");
    }
    try {
      return await crypto.subtle.wrapKey("jwk", aesKey, wrappingKey, {
        name: "RSA-OAEP"
      });
    } catch {
      throw new CryptosuiteError("RSA_OAEP_UNSUPPORTED", "WrapAgent.wrap: RSA-OAEP (4096/SHA-256) is not supported.");
    }
  }
};

// node_modules/@z-base/cryptosuite/dist/.helpers/assertRsaOaep4096PrivateKey.js
function assertRsaOaep4096PrivateKey(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("RSA_OAEP_PRIVATE_KEY_EXPECTED", `${context}: expected an RSA-OAEP private JWK.`);
  }
  if (jwk.kty !== "RSA") {
    throw new CryptosuiteError("RSA_OAEP_PRIVATE_KEY_EXPECTED", `${context}: expected kty RSA.`);
  }
  if (jwk.alg && jwk.alg !== RSA_OAEP_ALG) {
    throw new CryptosuiteError("RSA_OAEP_ALG_INVALID", `${context}: expected alg ${RSA_OAEP_ALG}.`);
  }
  if (jwk.use && jwk.use !== RSA_OAEP_USE) {
    throw new CryptosuiteError("RSA_OAEP_USE_INVALID", `${context}: expected use ${RSA_OAEP_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    if (!ops.has("unwrapKey")) {
      throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: key_ops must include unwrapKey.`);
    }
    for (const op of ops) {
      if (!RSA_PRIVATE_OPS.includes(op)) {
        throw new CryptosuiteError("RSA_OAEP_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
  }
  if (typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new CryptosuiteError("RSA_OAEP_PRIVATE_KEY_EXPECTED", `${context}: missing modulus or exponent.`);
  }
  if (typeof jwk.d !== "string") {
    throw new CryptosuiteError("RSA_OAEP_PRIVATE_KEY_EXPECTED", `${context}: missing private exponent.`);
  }
  let modulus;
  try {
    modulus = fromBase64UrlString(jwk.n);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url modulus.`);
  }
  if (modulus.byteLength !== RSA_MODULUS_BYTES) {
    throw new CryptosuiteError("RSA_OAEP_MODULUS_LENGTH_INVALID", `${context}: expected 4096-bit modulus.`);
  }
  let exponent;
  try {
    exponent = fromBase64UrlString(jwk.e);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url exponent.`);
  }
  let first = 0;
  while (first < exponent.length && exponent[first] === 0)
    first += 1;
  const remaining = exponent.length - first;
  if (remaining !== 3 || exponent[first] !== 1 || exponent[first + 1] !== 0 || exponent[first + 2] !== 1) {
    throw new CryptosuiteError("RSA_OAEP_EXPONENT_INVALID", `${context}: expected exponent 65537.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Exchange/UnwrapAgent/class.js
var UnwrapAgent = class {
  keyPromise;
  constructor(unwrapJwk) {
    assertRsaOaep4096PrivateKey(unwrapJwk, "UnwrapAgent");
    assertSubtleAvailable("UnwrapAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", unwrapJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["unwrapKey"]);
      } catch {
        throw new CryptosuiteError("RSA_OAEP_UNSUPPORTED", "UnwrapAgent: RSA-OAEP (4096/SHA-256) is not supported.");
      }
    })();
  }
  async unwrap(wrapped) {
    const unwrappingKey = await this.keyPromise;
    let aesKey;
    try {
      aesKey = await crypto.subtle.unwrapKey("jwk", wrapped, unwrappingKey, { name: "RSA-OAEP" }, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    } catch {
      throw new CryptosuiteError("RSA_OAEP_UNSUPPORTED", "UnwrapAgent.unwrap: RSA-OAEP (4096/SHA-256) is not supported.");
    }
    const jwk = await crypto.subtle.exportKey("jwk", aesKey);
    assertAesGcm256Key(jwk, "UnwrapAgent.unwrap");
    return jwk;
  }
};

// node_modules/@z-base/cryptosuite/dist/Exchange/ExchangeCluster/class.js
var ExchangeCluster = class _ExchangeCluster {
  static #wrapAgents = /* @__PURE__ */ new WeakMap();
  static #unwrapAgents = /* @__PURE__ */ new WeakMap();
  static #loadWrapAgent(wrapJwk) {
    const weakRef = _ExchangeCluster.#wrapAgents.get(wrapJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new WrapAgent(wrapJwk);
      _ExchangeCluster.#wrapAgents.set(wrapJwk, new WeakRef(agent));
    }
    return agent;
  }
  static #loadUnwrapAgent(unwrapJwk) {
    const weakRef = _ExchangeCluster.#unwrapAgents.get(unwrapJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new UnwrapAgent(unwrapJwk);
      _ExchangeCluster.#unwrapAgents.set(unwrapJwk, new WeakRef(agent));
    }
    return agent;
  }
  static async wrap(wrapJwk, cipherJwk) {
    const agent = _ExchangeCluster.#loadWrapAgent(wrapJwk);
    return await agent.wrap(cipherJwk);
  }
  static async unwrap(unwrapJwk, wrapped) {
    const agent = _ExchangeCluster.#loadUnwrapAgent(unwrapJwk);
    return await agent.unwrap(wrapped);
  }
};

// node_modules/@z-base/cryptosuite/dist/.helpers/assertRawHmac256Bytes.js
function assertRawHmac256Bytes(raw, context = "key material") {
  const length = getBufferSourceLength(raw, context);
  if (length !== HMAC_KEY_BYTES) {
    throw new CryptosuiteError("HMAC_RAW_LENGTH_INVALID", `${context}: expected 32 bytes (256-bit).`);
  }
}

// node_modules/@z-base/cryptosuite/dist/HMAC/deriveHMACKey/index.js
async function deriveHMACKey(rawKey) {
  assertSubtleAvailable("deriveHMACKey");
  assertRawHmac256Bytes(rawKey, "deriveHMACKey");
  let key;
  try {
    key = await crypto.subtle.importKey("raw", toBufferSource(rawKey), { name: "HMAC", hash: "SHA-256" }, true, ["sign", "verify"]);
  } catch {
    throw new CryptosuiteError("HMAC_SHA256_UNSUPPORTED", "deriveHMACKey: HMAC-SHA-256 is not supported.");
  }
  return await crypto.subtle.exportKey("jwk", key);
}

// node_modules/@z-base/cryptosuite/dist/HMAC/generateHMACKey/index.js
async function generateHMACKey() {
  assertSubtleAvailable("generateHMACKey");
  let hmacKey;
  try {
    hmacKey = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256", length: 256 }, true, ["sign", "verify"]);
  } catch {
    throw new CryptosuiteError("HMAC_SHA256_UNSUPPORTED", "generateHMACKey: HMAC-SHA-256 is not supported.");
  }
  return await crypto.subtle.exportKey("jwk", hmacKey);
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertHmacSha256Key.js
function assertHmacSha256Key(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("HMAC_KEY_EXPECTED", `${context}: expected an HMAC JWK.`);
  }
  if (jwk.kty !== "oct") {
    throw new CryptosuiteError("HMAC_KEY_EXPECTED", `${context}: expected an octet JWK for HMAC.`);
  }
  if (jwk.alg && jwk.alg !== HMAC_ALG) {
    throw new CryptosuiteError("HMAC_ALG_INVALID", `${context}: expected alg ${HMAC_ALG}.`);
  }
  if (jwk.use && jwk.use !== HMAC_USE) {
    throw new CryptosuiteError("HMAC_USE_INVALID", `${context}: expected use ${HMAC_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("HMAC_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    for (const op of ops) {
      if (!HMAC_KEY_OPS.includes(op)) {
        throw new CryptosuiteError("HMAC_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
    for (const required of HMAC_KEY_OPS) {
      if (!ops.has(required)) {
        throw new CryptosuiteError("HMAC_KEY_OPS_INVALID", `${context}: key_ops must include ${required}.`);
      }
    }
  }
  if (typeof jwk.k !== "string") {
    throw new CryptosuiteError("HMAC_KEY_EXPECTED", `${context}: missing key material.`);
  }
  let keyBytes;
  try {
    keyBytes = fromBase64UrlString(jwk.k);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url key material.`);
  }
  if (keyBytes.byteLength !== HMAC_KEY_BYTES) {
    throw new CryptosuiteError("HMAC_KEY_SIZE_INVALID", `${context}: expected 256-bit key material.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/HMAC/HMACAgent/class.js
var HMACAgent = class {
  keyPromise;
  constructor(hmacJwk) {
    assertHmacSha256Key(hmacJwk, "HMACAgent");
    assertSubtleAvailable("HMACAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", hmacJwk, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
      } catch {
        throw new CryptosuiteError("HMAC_SHA256_UNSUPPORTED", "HMACAgent: HMAC-SHA-256 is not supported.");
      }
    })();
  }
  async sign(bytes) {
    const key = await this.keyPromise;
    return crypto.subtle.sign("HMAC", key, toBufferSource(bytes));
  }
  async verify(bytes, signature) {
    const key = await this.keyPromise;
    return crypto.subtle.verify("HMAC", key, signature, toBufferSource(bytes));
  }
};

// node_modules/@z-base/cryptosuite/dist/HMAC/HMACCluster/class.js
var HMACCluster = class _HMACCluster {
  static #agents = /* @__PURE__ */ new WeakMap();
  static #loadAgent(hmacJwk) {
    const weakRef = _HMACCluster.#agents.get(hmacJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new HMACAgent(hmacJwk);
      _HMACCluster.#agents.set(hmacJwk, new WeakRef(agent));
    }
    return agent;
  }
  static async sign(hmacJwk, bytes) {
    const agent = _HMACCluster.#loadAgent(hmacJwk);
    return await agent.sign(bytes);
  }
  static async verify(hmacJwk, bytes, signature) {
    const agent = _HMACCluster.#loadAgent(hmacJwk);
    return await agent.verify(bytes, signature);
  }
};

// node_modules/@z-base/cryptosuite/dist/OID/index.js
async function deriveOID(rawId) {
  assertSubtleAvailable("deriveOID");
  let hash;
  try {
    hash = await crypto.subtle.digest("SHA-256", toBufferSource(rawId));
  } catch {
    throw new CryptosuiteError("SHA256_UNSUPPORTED", "deriveOID: SHA-256 is not supported.");
  }
  return toBase64UrlString(hash);
}
async function generateOID() {
  assertGetRandomValuesAvailable("generateOID");
  return toBase64UrlString(crypto.getRandomValues(new Uint8Array(32)));
}
function validateOID(id) {
  if (typeof id !== "string")
    return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(id))
    return false;
  return id;
}

// node_modules/@z-base/cryptosuite/dist/Verification/generateVerificationPair/index.js
async function generateVerificationPair() {
  assertSubtleAvailable("generateVerificationPair");
  let verificationPair;
  try {
    verificationPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  } catch {
    throw new CryptosuiteError("ED25519_UNSUPPORTED", "generateVerificationPair: Ed25519 is not supported.");
  }
  const signJwk = await crypto.subtle.exportKey("jwk", verificationPair.privateKey);
  const verifyJwk = await crypto.subtle.exportKey("jwk", verificationPair.publicKey);
  return { signJwk, verifyJwk };
}

// node_modules/@z-base/cryptosuite/dist/.helpers/assertEd25519PrivateKey.js
function assertEd25519PrivateKey(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("ED25519_PRIVATE_KEY_EXPECTED", `${context}: expected an Ed25519 private JWK.`);
  }
  if (jwk.kty !== "OKP") {
    throw new CryptosuiteError("ED25519_PRIVATE_KEY_EXPECTED", `${context}: expected kty OKP.`);
  }
  if (jwk.crv !== ED25519_CURVE) {
    throw new CryptosuiteError("ED25519_CURVE_INVALID", `${context}: expected curve ${ED25519_CURVE}.`);
  }
  if (jwk.alg && jwk.alg !== ED25519_ALG && jwk.alg !== "Ed25519") {
    throw new CryptosuiteError("ED25519_ALG_INVALID", `${context}: expected alg ${ED25519_ALG}.`);
  }
  if (jwk.use && jwk.use !== ED25519_USE) {
    throw new CryptosuiteError("ED25519_USE_INVALID", `${context}: expected use ${ED25519_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    if (!ops.has("sign")) {
      throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: key_ops must include sign.`);
    }
    for (const op of ops) {
      if (!ED25519_PRIVATE_OPS.includes(op)) {
        throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
  }
  if (typeof jwk.x !== "string") {
    throw new CryptosuiteError("ED25519_PRIVATE_KEY_EXPECTED", `${context}: missing public key.`);
  }
  if (typeof jwk.d !== "string") {
    throw new CryptosuiteError("ED25519_PRIVATE_KEY_EXPECTED", `${context}: missing private key.`);
  }
  let x;
  let d;
  try {
    x = fromBase64UrlString(jwk.x);
    d = fromBase64UrlString(jwk.d);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url key material.`);
  }
  if (x.byteLength !== ED25519_BYTES || d.byteLength !== ED25519_BYTES) {
    throw new CryptosuiteError("ED25519_KEY_SIZE_INVALID", `${context}: expected 32-byte key material.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Verification/SignAgent/class.js
var SignAgent = class {
  keyPromise;
  constructor(signJwk) {
    assertEd25519PrivateKey(signJwk, "SignAgent");
    assertSubtleAvailable("SignAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", signJwk, { name: "Ed25519" }, false, ["sign"]);
      } catch {
        throw new CryptosuiteError("ED25519_UNSUPPORTED", "SignAgent: Ed25519 is not supported.");
      }
    })();
  }
  async sign(bytes) {
    const key = await this.keyPromise;
    return crypto.subtle.sign("Ed25519", key, toBufferSource(bytes));
  }
};

// node_modules/@z-base/cryptosuite/dist/.helpers/assertEd25519PublicKey.js
function assertEd25519PublicKey(jwk, context = "key") {
  if (!jwk || typeof jwk !== "object") {
    throw new CryptosuiteError("ED25519_PUBLIC_KEY_EXPECTED", `${context}: expected an Ed25519 public JWK.`);
  }
  if (jwk.kty !== "OKP") {
    throw new CryptosuiteError("ED25519_PUBLIC_KEY_EXPECTED", `${context}: expected kty OKP.`);
  }
  if (jwk.crv !== ED25519_CURVE) {
    throw new CryptosuiteError("ED25519_CURVE_INVALID", `${context}: expected curve ${ED25519_CURVE}.`);
  }
  if (jwk.alg && jwk.alg !== ED25519_ALG && jwk.alg !== "Ed25519") {
    throw new CryptosuiteError("ED25519_ALG_INVALID", `${context}: expected alg ${ED25519_ALG}.`);
  }
  if (jwk.use && jwk.use !== ED25519_USE) {
    throw new CryptosuiteError("ED25519_USE_INVALID", `${context}: expected use ${ED25519_USE}.`);
  }
  if (jwk.key_ops) {
    if (!Array.isArray(jwk.key_ops)) {
      throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: key_ops must be an array.`);
    }
    const ops = new Set(jwk.key_ops);
    if (!ops.has("verify")) {
      throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: key_ops must include verify.`);
    }
    for (const op of ops) {
      if (!ED25519_PUBLIC_OPS.includes(op)) {
        throw new CryptosuiteError("ED25519_KEY_OPS_INVALID", `${context}: unexpected key_ops value.`);
      }
    }
  }
  if (typeof jwk.x !== "string") {
    throw new CryptosuiteError("ED25519_PUBLIC_KEY_EXPECTED", `${context}: missing public key.`);
  }
  if (typeof jwk.d === "string") {
    throw new CryptosuiteError("ED25519_PUBLIC_KEY_EXPECTED", `${context}: private parameters are not allowed.`);
  }
  let x;
  try {
    x = fromBase64UrlString(jwk.x);
  } catch {
    throw new CryptosuiteError("BASE64URL_INVALID", `${context}: invalid base64url key material.`);
  }
  if (x.byteLength !== ED25519_BYTES) {
    throw new CryptosuiteError("ED25519_KEY_SIZE_INVALID", `${context}: expected 32-byte public key.`);
  }
}

// node_modules/@z-base/cryptosuite/dist/Verification/VerifyAgent/class.js
var VerifyAgent = class {
  keyPromise;
  constructor(verifyJwk) {
    assertEd25519PublicKey(verifyJwk, "VerifyAgent");
    assertSubtleAvailable("VerifyAgent");
    this.keyPromise = (async () => {
      try {
        return await crypto.subtle.importKey("jwk", verifyJwk, { name: "Ed25519" }, false, ["verify"]);
      } catch {
        throw new CryptosuiteError("ED25519_UNSUPPORTED", "VerifyAgent: Ed25519 is not supported.");
      }
    })();
  }
  async verify(bytes, signature) {
    const key = await this.keyPromise;
    return crypto.subtle.verify("Ed25519", key, signature, toBufferSource(bytes));
  }
};

// node_modules/@z-base/cryptosuite/dist/Verification/VerificationCluster/class.js
var VerificationCluster = class _VerificationCluster {
  static #signAgents = /* @__PURE__ */ new WeakMap();
  static #verifyAgents = /* @__PURE__ */ new WeakMap();
  static #loadSignAgent(signJwk) {
    const weakRef = _VerificationCluster.#signAgents.get(signJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new SignAgent(signJwk);
      _VerificationCluster.#signAgents.set(signJwk, new WeakRef(agent));
    }
    return agent;
  }
  static #loadVerifyAgent(verifyJwk) {
    const weakRef = _VerificationCluster.#verifyAgents.get(verifyJwk);
    let agent = weakRef?.deref();
    if (!agent) {
      agent = new VerifyAgent(verifyJwk);
      _VerificationCluster.#verifyAgents.set(verifyJwk, new WeakRef(agent));
    }
    return agent;
  }
  static async sign(signJwk, bytes) {
    const agent = _VerificationCluster.#loadSignAgent(signJwk);
    return await agent.sign(bytes);
  }
  static async verify(verifyJwk, bytes, signature) {
    const agent = _VerificationCluster.#loadVerifyAgent(verifyJwk);
    return await agent.verify(bytes, signature);
  }
};

// node_modules/@z-base/cryptosuite/dist/index.js
var Cryptosuite = class {
  static cipher = {
    encrypt: CipherCluster.encrypt,
    decrypt: CipherCluster.decrypt,
    deriveKey: deriveCipherKey,
    generateKey: generateCipherKey
  };
  static exchange = {
    wrap: ExchangeCluster.wrap,
    unwrap: ExchangeCluster.unwrap,
    generatePair: generateExchangePair
  };
  static hmac = {
    sign: HMACCluster.sign,
    verify: HMACCluster.verify,
    deriveKey: deriveHMACKey,
    generateKey: generateHMACKey
  };
  static oid = {
    derive: deriveOID,
    generate: generateOID,
    validate: validateOID
  };
  static verification = {
    sign: VerificationCluster.sign,
    verify: VerificationCluster.verify,
    generatePair: generateVerificationPair
  };
};

// dist/ZKCredentials/errors.js
var ZKCredentialError = class extends Error {
  code;
  constructor(code, message) {
    super(message ?? `{@z-base/zero-knowledge-credentials} ${code}`);
    this.code = code;
  }
};

// dist/ZKCredentials/fromPRF.js
async function fromPRF(prfResults) {
  if (!prfResults)
    return false;
  const { first, second } = prfResults;
  if (!first || !second)
    throw new ZKCredentialError("prf-unavailable", "One or more prf extensions results are missing");
  if (!crypto?.subtle)
    throw new ZKCredentialError("unsupported", "Web Crypto SubtleCrypto is not available");
  const firstHash = await crypto.subtle.digest("SHA-256", toBufferSource(first));
  const secondHash = await crypto.subtle.digest("SHA-256", toBufferSource(second));
  const [hmacJwk, cipherJwk] = await Promise.all([
    deriveHMACKey(toUint8Array(firstHash)),
    deriveCipherKey(toUint8Array(secondHash))
  ]);
  return { hmacJwk, cipherJwk };
}

// dist/ZKCredentials/class.js
var ZKCredentials = class {
  static #timeout = 6e4;
  static #mediation = "required";
  static #userVerification = "required";
  static #prfInput1 = toBufferSource(fromString("credential-hmac-key-seed"));
  static #prfInput2 = toBufferSource(fromString("credential-cipher-key-seed"));
  static async #assertSupported(options) {
    if (typeof window === "undefined")
      throw new ZKCredentialError("unsupported");
    if (!("PublicKeyCredential" in window))
      throw new ZKCredentialError("unsupported");
    if (!navigator.credentials)
      throw new ZKCredentialError("unsupported");
    if (!window.crypto || !window.crypto.subtle)
      throw new ZKCredentialError("unsupported");
    if (options?.requirePlatformUV) {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
        throw new ZKCredentialError("unsupported");
      }
      const uv = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!uv)
        throw new ZKCredentialError("unsupported");
    }
  }
  static async registerCredential(usersDisplayName, authenticatorAttachment, signal) {
    try {
      await this.#assertSupported({
        requirePlatformUV: authenticatorAttachment === "platform"
      });
    } catch {
      return this.onNotSupported();
    }
    const publicKey = {
      rp: { id: window.location.hostname, name: window.location.host },
      user: {
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: usersDisplayName,
        displayName: usersDisplayName
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 }
      ],
      authenticatorSelection: {
        authenticatorAttachment,
        residentKey: "required",
        userVerification: this.#userVerification
      },
      timeout: this.#timeout,
      attestation: "none",
      extensions: {
        prf: {
          eval: {
            first: this.#prfInput1,
            second: this.#prfInput2
          }
        }
      }
    };
    try {
      await navigator.credentials.create({ publicKey, signal });
    } catch (error) {
      if (error?.name === "AbortError")
        throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      if (error?.name === "NotSupportedError" || error?.name === "SecurityError") {
        throw new ZKCredentialError("unsupported");
      }
      throw error;
    }
  }
  static async discoverCredential(signal) {
    try {
      await this.#assertSupported();
    } catch {
      return this.onNotSupported();
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
                second: this.#prfInput2
              }
            }
          }
        },
        mediation: this.#mediation,
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError")
        throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      if (error?.name === "NotSupportedError" || error?.name === "SecurityError") {
        throw new ZKCredentialError("unsupported");
      }
      throw error;
    }
    if (!credential || credential.type !== "public-key")
      throw new ZKCredentialError("no-credential");
    const typed = credential;
    const prf = typed.getClientExtensionResults().prf;
    if (!prf?.results)
      throw new ZKCredentialError("prf-unavailable");
    let keys;
    try {
      keys = await fromPRF(prf.results);
    } catch (error) {
      if (error instanceof ZKCredentialError)
        throw error;
      throw new ZKCredentialError("key-derivation-failed");
    }
    if (!keys)
      throw new ZKCredentialError("key-derivation-failed");
    const id = await deriveOID(toUint8Array(typed.rawId));
    return {
      id,
      hmacJwk: keys.hmacJwk,
      cipherJwk: keys.cipherJwk
    };
  }
  static async generateCredential() {
    return {
      id: await generateOID(),
      hmacJwk: await generateHMACKey(),
      cipherJwk: await generateCipherKey()
    };
  }
  static onNotSupported = () => {
    throw new ZKCredentialError("unsupported", "{@z-base/zero-knowledge-credentials} WebAuthn capability not supported on this host");
  };
};

// in-browser-testing-libs.js
globalThis.Bytes = Bytes;
globalThis.Cryptosuite = Cryptosuite;
globalThis.ZKCredentials = ZKCredentials;
