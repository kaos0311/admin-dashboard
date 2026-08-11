import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildRateLimitBucketId,
  checkRateLimit,
  getClientIp,
  MemoryRateLimitStore,
  rateLimitResponse,
} from "./rate-limit";

const ORIGINAL_ENV = { ...process.env };

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://app.advhomemed.com/api/test", { headers });
}

describe("rate limiting", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
    process.env.RATE_LIMIT_GENERAL_LIMIT = "2";
    process.env.RATE_LIMIT_GENERAL_WINDOW_SECONDS = "10";
    process.env.RATE_LIMIT_AI_LIMIT = "1";
    process.env.RATE_LIMIT_AI_WINDOW_SECONDS = "60";
  });

  it("allows normal traffic within the configured burst", async () => {
    const store = new MemoryRateLimitStore();

    await expect(
      checkRateLimit({
        request: request(),
        policyName: "general",
        identifier: "user-1",
        store,
        now: 1_000,
      }),
    ).resolves.toEqual({ ok: true, remaining: 1 });

    await expect(
      checkRateLimit({
        request: request(),
        policyName: "general",
        identifier: "user-1",
        store,
        now: 1_000,
      }),
    ).resolves.toEqual({ ok: true, remaining: 0 });
  });

  it("returns a retry-after value when a burst exceeds the limit", async () => {
    const store = new MemoryRateLimitStore();
    const args = {
      request: request(),
      policyName: "general" as const,
      identifier: "user-1",
      store,
      now: 1_000,
    };

    await checkRateLimit(args);
    await checkRateLimit(args);
    const result = await checkRateLimit(args);

    expect(result).toEqual({
      ok: false,
      retryAfterSeconds: 5,
      reason: "limited",
    });
  });

  it("isolates authenticated users and anonymous IP buckets", async () => {
    const store = new MemoryRateLimitStore();

    await checkRateLimit({
      request: request(),
      policyName: "general",
      identifier: "user-1",
      store,
      now: 1_000,
    });
    await checkRateLimit({
      request: request(),
      policyName: "general",
      identifier: "user-1",
      store,
      now: 1_000,
    });

    await expect(
      checkRateLimit({
        request: request(),
        policyName: "general",
        identifier: "user-2",
        store,
        now: 1_000,
      }),
    ).resolves.toEqual({ ok: true, remaining: 1 });
  });

  it("isolates multiple trusted Cloudflare IPs", async () => {
    vi.stubEnv("RATE_LIMIT_TRUST_PROXY_HEADERS", "true");
    const store = new MemoryRateLimitStore();

    await checkRateLimit({
      request: request({ "cf-ray": "ray", "cf-connecting-ip": "203.0.113.1" }),
      policyName: "general",
      scope: "ip",
      store,
      now: 1_000,
    });
    await checkRateLimit({
      request: request({ "cf-ray": "ray", "cf-connecting-ip": "203.0.113.1" }),
      policyName: "general",
      scope: "ip",
      store,
      now: 1_000,
    });

    await expect(
      checkRateLimit({
        request: request({ "cf-ray": "ray", "cf-connecting-ip": "203.0.113.2" }),
        policyName: "general",
        scope: "ip",
        store,
        now: 1_000,
      }),
    ).resolves.toEqual({ ok: true, remaining: 1 });
  });

  it("resets after the token window refills", async () => {
    const store = new MemoryRateLimitStore();

    await checkRateLimit({
      request: request(),
      policyName: "general",
      identifier: "user-1",
      store,
      now: 1_000,
    });
    await checkRateLimit({
      request: request(),
      policyName: "general",
      identifier: "user-1",
      store,
      now: 1_000,
    });

    await expect(
      checkRateLimit({
        request: request(),
        policyName: "general",
        identifier: "user-1",
        store,
        now: 11_000,
      }),
    ).resolves.toEqual({ ok: true, remaining: 1 });
  });

  it("handles concurrent requests atomically with the store contract", async () => {
    const store = new MemoryRateLimitStore();

    const results = await Promise.all([
      checkRateLimit({ request: request(), policyName: "general", identifier: "u", store }),
      checkRateLimit({ request: request(), policyName: "general", identifier: "u", store }),
      checkRateLimit({ request: request(), policyName: "general", identifier: "u", store }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
  });

  it("fails closed when the backing store is unavailable", async () => {
    const result = await checkRateLimit({
      request: request(),
      policyName: "general",
      store: {
        async consume() {
          throw new Error("store unavailable");
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      retryAfterSeconds: 60,
      reason: "unavailable",
    });
  });

  it("returns a controlled 429 response with Retry-After", () => {
    const response = rateLimitResponse({
      ok: false,
      retryAfterSeconds: 7,
      reason: "limited",
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
  });

  it("does not trust spoofed forwarded IP headers without Cloudflare trust", () => {
    expect(
      getClientIp(
        request({
          "x-forwarded-for": "203.0.113.10",
          "cf-connecting-ip": "203.0.113.10",
        }).headers,
      ),
    ).toBe("unknown");
  });

  it("does not store raw identifiers in bucket IDs", () => {
    const bucket = buildRateLimitBucketId({
      policyName: "ai",
      scope: "user",
      identifier: "user@example.com",
    });

    expect(bucket).not.toContain("user@example.com");
    expect(bucket).toMatch(/^v1:ai:user:/);
  });
});
