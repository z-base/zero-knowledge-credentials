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
