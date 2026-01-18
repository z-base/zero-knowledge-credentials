import { Bytes } from "bytecodec";
import { deriveRootKeys } from "zeyra";

export type ZKCredential = {
  id: Base64URLString;
  hmacJwk: JsonWebKey;
  cipherJwk: JsonWebKey;
};

export type ZKCredentialErrorCode =
  | "unsupported"
  | "aborted"
  | "user-denied"
  | "no-credential"
  | "prf-unavailable"
  | "key-derivation-failed";

export class ZKCredentialError extends Error {
  readonly code: ZKCredentialErrorCode;

  constructor(code: ZKCredentialErrorCode, message?: string) {
    super(message ?? `{ZKCredentials} ${code}`);
    this.code = code;
  }
}

export class ZKCredentials {
  static readonly #timeout = 60_000;
  static readonly #mediation: CredentialRequestOptions["mediation"] =
    "required";
  static readonly #userVerification: AuthenticatorSelectionCriteria["userVerification"] =
    "required";

  static readonly #prfInput1: BufferSource = Bytes.toBufferSource(
    Bytes.fromString("credential-hmac-key-seed"),
  );
  static readonly #prfInput2: BufferSource = Bytes.toBufferSource(
    Bytes.fromString("credential-cipher-key-seed"),
  );

  static async #assertSupported(): Promise<void> {
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

    const pcm = (PublicKeyCredential as any).isConditionalMediationAvailable;
    if (typeof pcm === "function" && !(await pcm())) {
      throw new ZKCredentialError("unsupported");
    }
  }

  static async registerCredential(
    usersDisplayName: string,
    authenticatorAttachment: AuthenticatorAttachment,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      await this.#assertSupported();
    } catch {
      return this.ifIsNotSupported();
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
    } catch (error: any) {
      if (error?.name === "AbortError") throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      throw error;
    }
  }

  static async discoverCredential(signal?: AbortSignal): Promise<ZKCredential> {
    try {
      await this.#assertSupported();
    } catch {
      return this.ifIsNotSupported();
    }

    let credential: Credential | null;
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
    } catch (error: any) {
      if (error?.name === "AbortError") throw new ZKCredentialError("aborted");
      if (error?.name === "NotAllowedError")
        throw new ZKCredentialError("user-denied");
      throw error;
    }

    if (!credential || credential.type !== "public-key")
      throw new ZKCredentialError("no-credential");

    const typed = credential as PublicKeyCredential;
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

  static ifIsNotSupported: () => never = () => {
    throw new ZKCredentialError(
      "unsupported",
      "{ZKCredentials} WebAuthn capability not supported on this device",
    );
  };
}
