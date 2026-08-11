import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type HeaderReader, validateSessionCsrf } from "./session-csrf";

const ORIGINAL_ENV = { ...process.env };

function headers(values: Record<string, string | undefined>): HeaderReader {
  const normalized = new Map(
    Object.entries(values)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    get(name: string): string | null {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  };
}

describe("validateSessionCsrf", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_TRUSTED_ORIGINS = "https://app.advhomemed.com/";
    delete process.env.AUTH_TRUST_PROXY_HEADERS;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts a trusted origin with matching host", () => {
    expect(
      validateSessionCsrf(
        headers({
          origin: "https://app.advhomemed.com",
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects an untrusted origin", () => {
    expect(
      validateSessionCsrf(
        headers({
          origin: "https://evil.example",
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: false, reason: "untrusted" });
  });

  it("rejects a malformed origin", () => {
    expect(
      validateSessionCsrf(
        headers({
          origin: "not a url",
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a missing origin", () => {
    expect(
      validateSessionCsrf(
        headers({
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: false, reason: "missing" });
  });

  it("accepts localhost only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.AUTH_TRUSTED_ORIGINS;

    expect(
      validateSessionCsrf(
        headers({
          origin: "http://localhost:3000",
          host: "localhost:3000",
        }),
      ),
    ).toEqual({ ok: true });

    vi.stubEnv("NODE_ENV", "production");
    process.env.AUTH_TRUSTED_ORIGINS = "http://localhost:3000";

    expect(
      validateSessionCsrf(
        headers({
          origin: "http://localhost:3000",
          host: "localhost:3000",
        }),
      ),
    ).toEqual({ ok: false, reason: "misconfigured" });
  });

  it("uses Cloudflare forwarded host and proto when explicitly trusted", () => {
    process.env.AUTH_TRUST_PROXY_HEADERS = "true";

    expect(
      validateSessionCsrf(
        headers({
          origin: "https://app.advhomemed.com",
          host: "internal.local",
          "x-forwarded-host": "app.advhomemed.com",
          "x-forwarded-proto": "https",
          "cf-ray": "ray-id",
        }),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects spoofed forwarded headers without the trust boundary", () => {
    process.env.AUTH_TRUST_PROXY_HEADERS = "true";

    expect(
      validateSessionCsrf(
        headers({
          origin: "https://app.advhomemed.com",
          host: "internal.local",
          "x-forwarded-host": "app.advhomemed.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toEqual({ ok: false, reason: "host-mismatch" });
  });

  it("fails closed in production without trusted origins", () => {
    delete process.env.AUTH_TRUSTED_ORIGINS;

    expect(
      validateSessionCsrf(
        headers({
          origin: "https://app.advhomemed.com",
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: false, reason: "misconfigured" });
  });

  it("rejects invalid trusted-origin configuration", () => {
    process.env.AUTH_TRUSTED_ORIGINS = "https://app.advhomemed.com, *";

    expect(
      validateSessionCsrf(
        headers({
          origin: "https://app.advhomemed.com",
          host: "app.advhomemed.com",
        }),
      ),
    ).toEqual({ ok: false, reason: "misconfigured" });
  });
});
