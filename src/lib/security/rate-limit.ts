import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebaseAdmin";

export type RateLimitPolicyName =
  | "login"
  | "session"
  | "ai"
  | "import"
  | "general"
  | "admin";

type RateLimitPolicy = {
  capacity: number;
  windowSeconds: number;
};

type RateLimitRecord = {
  tokens: number;
  updatedAt: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number; reason: "limited" | "unavailable" };

export type RateLimitStore = {
  consume(bucketId: string, policy: RateLimitPolicy, now: number): Promise<RateLimitResult>;
};

type RateLimitScope = "ip" | "user" | "api-key" | "global";

const DEFAULT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  login: { capacity: 5, windowSeconds: 60 },
  session: { capacity: 10, windowSeconds: 60 },
  ai: { capacity: 20, windowSeconds: 300 },
  import: { capacity: 10, windowSeconds: 300 },
  general: { capacity: 120, windowSeconds: 60 },
  admin: { capacity: 30, windowSeconds: 300 },
};

const TRUST_PROXY_ENV = "RATE_LIMIT_TRUST_PROXY_HEADERS";

function envName(policyName: RateLimitPolicyName, suffix: "LIMIT" | "WINDOW_SECONDS"): string {
  return `RATE_LIMIT_${policyName.toUpperCase()}_${suffix}`;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRateLimitPolicy(policyName: RateLimitPolicyName): RateLimitPolicy {
  const defaults = DEFAULT_POLICIES[policyName];
  return {
    capacity: readPositiveInteger(envName(policyName, "LIMIT"), defaults.capacity),
    windowSeconds: readPositiveInteger(
      envName(policyName, "WINDOW_SECONDS"),
      defaults.windowSeconds,
    ),
  };
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function splitHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function shouldTrustProxyHeaders(headers: Headers): boolean {
  if (process.env[TRUST_PROXY_ENV] !== "true") return false;
  return Boolean(headers.get("cf-ray") || headers.get("cf-connecting-ip"));
}

export function getClientIp(headers: Headers): string {
  if (shouldTrustProxyHeaders(headers)) {
    return (
      splitHeader(headers.get("cf-connecting-ip")) ??
      splitHeader(headers.get("x-forwarded-for")) ??
      "unknown"
    );
  }

  return "unknown";
}

export function buildRateLimitBucketId(args: {
  policyName: RateLimitPolicyName;
  scope: RateLimitScope;
  identifier: string;
}): string {
  return [
    "v1",
    args.policyName,
    args.scope,
    hashIdentifier(args.identifier || "unknown"),
  ].join(":");
}

export class FirestoreRateLimitStore implements RateLimitStore {
  async consume(
    bucketId: string,
    policy: RateLimitPolicy,
    now: number,
  ): Promise<RateLimitResult> {
    const ref = adminDb.collection("rateLimitBuckets").doc(bucketId);

    return adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const existing = snapshot.exists
        ? (snapshot.data() as Partial<RateLimitRecord>)
        : null;

      const refillRatePerMs = policy.capacity / (policy.windowSeconds * 1000);
      const previousTokens =
        typeof existing?.tokens === "number" ? existing.tokens : policy.capacity;
      const updatedAt =
        typeof existing?.updatedAt === "number" ? existing.updatedAt : now;
      const elapsed = Math.max(0, now - updatedAt);
      const available = Math.min(
        policy.capacity,
        previousTokens + elapsed * refillRatePerMs,
      );

      if (available < 1) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((1 - available) / refillRatePerMs / 1000),
        );
        transaction.set(
          ref,
          {
            tokens: available,
            updatedAt: now,
            expiresAt: new Date(now + policy.windowSeconds * 1000 * 2),
          },
          { merge: true },
        );
        return { ok: false, retryAfterSeconds, reason: "limited" };
      }

      const remaining = available - 1;
      transaction.set(
        ref,
        {
          tokens: remaining,
          updatedAt: now,
          expiresAt: new Date(now + policy.windowSeconds * 1000 * 2),
        },
        { merge: true },
      );
      return { ok: true, remaining: Math.floor(remaining) };
    });
  }
}

const defaultStore = new FirestoreRateLimitStore();

function logRateLimitEvent(
  event: "allowed" | "limited" | "unavailable",
  details: Record<string, unknown>,
): void {
  if (event === "allowed") return;

  console.warn("[rate-limit]", {
    event,
    ...details,
  });
}

export async function checkRateLimit(args: {
  request: Request;
  policyName: RateLimitPolicyName;
  scope?: RateLimitScope;
  identifier?: string;
  store?: RateLimitStore;
  now?: number;
}): Promise<RateLimitResult> {
  const scope = args.scope ?? (args.identifier ? "user" : "ip");
  const identifier = args.identifier ?? getClientIp(args.request.headers);
  const policy = getRateLimitPolicy(args.policyName);
  const bucketId = buildRateLimitBucketId({
    policyName: args.policyName,
    scope,
    identifier,
  });

  try {
    const result = await (args.store ?? defaultStore).consume(
      bucketId,
      policy,
      args.now ?? Date.now(),
    );

    if (!result.ok) {
      logRateLimitEvent(result.reason, {
        policy: args.policyName,
        scope,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    return result;
  } catch (error) {
    logRateLimitEvent("unavailable", {
      policy: args.policyName,
      scope,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, retryAfterSeconds: 60, reason: "unavailable" };
  }
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

export async function enforceRateLimit(args: {
  request: Request;
  policyName: RateLimitPolicyName;
  scope?: RateLimitScope;
  identifier?: string;
}): Promise<NextResponse | null> {
  const result = await checkRateLimit(args);
  return result.ok ? null : rateLimitResponse(result);
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly records = new Map<string, RateLimitRecord>();

  async consume(
    bucketId: string,
    policy: RateLimitPolicy,
    now: number,
  ): Promise<RateLimitResult> {
    const existing = this.records.get(bucketId);
    const refillRatePerMs = policy.capacity / (policy.windowSeconds * 1000);
    const previousTokens = existing?.tokens ?? policy.capacity;
    const updatedAt = existing?.updatedAt ?? now;
    const available = Math.min(
      policy.capacity,
      previousTokens + Math.max(0, now - updatedAt) * refillRatePerMs,
    );

    if (available < 1) {
      this.records.set(bucketId, { tokens: available, updatedAt: now });
      return {
        ok: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((1 - available) / refillRatePerMs / 1000),
        ),
        reason: "limited",
      };
    }

    const remaining = available - 1;
    this.records.set(bucketId, { tokens: remaining, updatedAt: now });
    return { ok: true, remaining: Math.floor(remaining) };
  }
}
