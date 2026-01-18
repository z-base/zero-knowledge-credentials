import path from "node:path";
import { expect, test } from "playwright/test";

const bundlePath = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "zkcredentials.bundle.js",
);

const installMocks = () => {
  const state = {
    uvAvailable: true,
    conditionalAvailable: true,
    createErrorName: null,
    getErrorName: null,
    returnNullCredential: false,
    credentialType: "public-key",
    prfResultsMissing: false,
    prfResultsInvalid: false,
    rawIdSeed: 1,
    prfFirstSeed: 101,
    prfSecondSeed: 202,
    lastCreateOptions: null,
    lastGetOptions: null,
  };

  const makeBytes = (size: number, seed: number) => {
    const bytes = new Uint8Array(size);
    for (let index = 0; index < size; index++) {
      bytes[index] = (seed + index) & 0xff;
    }
    return bytes;
  };

  const makeError = (name: string) => new DOMException(name, name);

  const buildCredential = () => {
    const rawId = makeBytes(32, state.rawIdSeed).buffer;
    if (state.prfResultsMissing) {
      return {
        type: state.credentialType,
        rawId,
        getClientExtensionResults() {
          return {};
        },
      };
    }

    const prfResults = state.prfResultsInvalid
      ? {
          first: new Uint8Array([1]),
          second: new Uint8Array([2]),
        }
      : {
          first: makeBytes(32, state.prfFirstSeed).buffer,
          second: makeBytes(32, state.prfSecondSeed).buffer,
        };

    return {
      type: state.credentialType,
      rawId,
      getClientExtensionResults() {
        return { prf: { results: prfResults } };
      },
    };
  };

  const create = async (options: unknown) => {
    state.lastCreateOptions = options;
    if (state.createErrorName) throw makeError(state.createErrorName);
    return { type: "public-key" };
  };

  const get = async (options: unknown) => {
    state.lastGetOptions = options;
    if (state.getErrorName) throw makeError(state.getErrorName);
    if (state.returnNullCredential) return null;
    if (state.credentialType !== "public-key") return { type: state.credentialType };
    return buildCredential();
  };

  const setCredentialMethod = (name: "create" | "get", fn: any) => {
    const creds = (navigator as any).credentials;
    try {
      creds[name] = fn;
      return;
    } catch {
      try {
        Object.defineProperty(creds, name, { value: fn, configurable: true });
      } catch {
        // Ignore if the runtime forbids stubbing.
      }
    }
  };

  if ((navigator as any).credentials) {
    setCredentialMethod("create", create);
    setCredentialMethod("get", get);
  } else {
    Object.defineProperty(navigator, "credentials", {
      value: { create, get },
      configurable: true,
    });
  }

  const MockPublicKeyCredential = class {};
  let pkc = (globalThis as any).PublicKeyCredential;

  try {
    Object.defineProperty(globalThis, "PublicKeyCredential", {
      value: MockPublicKeyCredential,
      configurable: true,
      writable: true,
    });
    pkc = MockPublicKeyCredential;
  } catch {
    if (!pkc) pkc = MockPublicKeyCredential;
  }

  const setPkcMethod = (name: string, fn: any) => {
    try {
      pkc[name] = fn;
      return;
    } catch {
      try {
        Object.defineProperty(pkc, name, { value: fn, configurable: true });
      } catch {
        // Ignore if the runtime forbids stubbing.
      }
    }
  };

  setPkcMethod("isUserVerifyingPlatformAuthenticatorAvailable", async () =>
    state.uvAvailable,
  );
  setPkcMethod("isConditionalMediationAvailable", async () =>
    state.conditionalAvailable,
  );

  (globalThis as any).__zkcState = state;
};

const setState = async (page: any, patch: Record<string, unknown>) => {
  await page.evaluate((next) => {
    const target =
      (globalThis as any).__zkcState ??
      ((globalThis as any).__zkcState = {});
    Object.assign(target, next);
  }, patch);
};

const runRegister = async (
  page: any,
  displayName = "User",
  attachment: "platform" | "cross-platform" = "platform",
) =>
  page.evaluate(
    async ({ displayName, attachment }) => {
      const { ZKCredentials } = (globalThis as any).ZKCredentialsBundle;
      try {
        await ZKCredentials.registerCredential(displayName, attachment);
        return { ok: true };
      } catch (error: any) {
        return {
          ok: false,
          code: error?.code ?? null,
          name: error?.name ?? null,
          message: error?.message ?? null,
        };
      }
    },
    { displayName, attachment },
  );

const runDiscover = async (page: any) =>
  page.evaluate(async () => {
    const { ZKCredentials } = (globalThis as any).ZKCredentialsBundle;
    try {
      const result = await ZKCredentials.discoverCredential();
      return {
        ok: true,
        id: result.id,
        cipherJwk: result.cipherJwk,
        hmacJwk: result.hmacJwk,
      };
    } catch (error: any) {
      return {
        ok: false,
        code: error?.code ?? null,
        name: error?.name ?? null,
        message: error?.message ?? null,
      };
    }
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installMocks);
  await page.route("https://zkcredentials.test/", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><head></head><body></body></html>",
    });
  });
  await page.goto("https://zkcredentials.test/");
  await page.addScriptTag({ path: bundlePath });
});

test.describe("ZKCredentials.registerCredential", () => {
  test("returns unsupported when UV is unavailable", async ({ page }) => {
    await setState(page, { uvAvailable: false });
    const result = await runRegister(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("unsupported");
  });

  test("maps AbortError to aborted", async ({ page }) => {
    await setState(page, { createErrorName: "AbortError" });
    const result = await runRegister(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("aborted");
  });

  test("maps NotAllowedError to user-denied", async ({ page }) => {
    await setState(page, { createErrorName: "NotAllowedError" });
    const result = await runRegister(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("user-denied");
  });

  test("passes expected create options", async ({ page }) => {
    const result = await runRegister(page, "Alice", "platform");
    expect(result.ok).toBe(true);

    const details = await page.evaluate(() => {
      const state = (globalThis as any).__zkcState;
      const { publicKey } = state.lastCreateOptions;
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
        algs: publicKey.pubKeyCredParams.map((item: any) => item.alg),
        prfFirstLength:
          publicKey.extensions?.prf?.eval?.first?.byteLength ?? 0,
        prfSecondLength:
          publicKey.extensions?.prf?.eval?.second?.byteLength ?? 0,
      };
    });

    expect(details.rpId).toBeTruthy();
    expect(details.rpName).toBeTruthy();
    expect(details.userName).toBe("Alice");
    expect(details.userDisplayName).toBe("Alice");
    expect(details.userIdLength).toBe(32);
    expect(details.challengeLength).toBe(32);
    expect(details.attachment).toBe("platform");
    expect(details.residentKey).toBe("required");
    expect(details.userVerification).toBe("required");
    expect(details.timeout).toBe(60_000);
    expect(details.attestation).toBe("none");
    expect(details.algs).toEqual(expect.arrayContaining([-7, -257]));
    expect(details.prfFirstLength).toBeGreaterThan(0);
    expect(details.prfSecondLength).toBeGreaterThan(0);
  });
});

test.describe("ZKCredentials.discoverCredential", () => {
  test("returns unsupported when UV is unavailable", async ({ page }) => {
    await setState(page, { uvAvailable: false });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("unsupported");
  });

  test("maps AbortError to aborted", async ({ page }) => {
    await setState(page, { getErrorName: "AbortError" });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("aborted");
  });

  test("maps NotAllowedError to user-denied", async ({ page }) => {
    await setState(page, { getErrorName: "NotAllowedError" });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("user-denied");
  });

  test("returns no-credential when get returns null", async ({ page }) => {
    await setState(page, { returnNullCredential: true });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("no-credential");
  });

  test("returns no-credential when type is not public-key", async ({ page }) => {
    await setState(page, { credentialType: "password" });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("no-credential");
  });

  test("returns prf-unavailable when results are missing", async ({ page }) => {
    await setState(page, { prfResultsMissing: true });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("prf-unavailable");
  });

  test("returns key-derivation-failed when results are invalid", async ({
    page,
  }) => {
    await setState(page, { prfResultsInvalid: true });
    const result = await runDiscover(page);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("key-derivation-failed");
  });

  test("returns derived id and keys", async ({ page }) => {
    const result = await runDiscover(page);
    expect(result.ok).toBe(true);
    expect(result.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.cipherJwk.kty).toBe("oct");
    expect(result.hmacJwk.kty).toBe("oct");
    expect(result.cipherJwk.key_ops).toEqual(
      expect.arrayContaining(["encrypt", "decrypt"]),
    );
    expect(result.hmacJwk.key_ops).toEqual(
      expect.arrayContaining(["sign", "verify"]),
    );
  });

  test("passes expected get options", async ({ page }) => {
    const result = await runDiscover(page);
    expect(result.ok).toBe(true);

    const details = await page.evaluate(() => {
      const state = (globalThis as any).__zkcState;
      const { publicKey } = state.lastGetOptions;
      return {
        rpId: publicKey.rpId,
        allowCredentialsLength: publicKey.allowCredentials.length,
        userVerification: publicKey.userVerification,
        timeout: publicKey.timeout,
        mediation: state.lastGetOptions.mediation,
        prfFirstLength:
          publicKey.extensions?.prf?.eval?.first?.byteLength ?? 0,
        prfSecondLength:
          publicKey.extensions?.prf?.eval?.second?.byteLength ?? 0,
      };
    });

    expect(details.rpId).toBeTruthy();
    expect(details.allowCredentialsLength).toBe(0);
    expect(details.userVerification).toBe("required");
    expect(details.timeout).toBe(60_000);
    expect(details.mediation).toBe("required");
    expect(details.prfFirstLength).toBeGreaterThan(0);
    expect(details.prfSecondLength).toBeGreaterThan(0);
  });
});
