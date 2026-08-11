import { createHash } from "node:crypto";

import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";

export type CallableRateLimitPolicyName =
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

type CallableRateLimitRequest = {
  auth?: { uid?: string } | null;
  rawRequest?: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
  };
};

const DEFAULT_POLICIES: Record<CallableRateLimitPolicyName, RateLimitPolicy> = {
  login: { capacity: 5, windowSeconds: 60 },
  session: { capacity: 10, windowSeconds: 60 },
  ai: { capacity: 20, windowSeconds: 300 },
  import: { capacity: 10, windowSeconds: 300 },
  general: { capacity: 120, windowSeconds: 60 },
  admin: { capacity: 30, windowSeconds: 300 },
};

const TRUST_PROXY_ENV = "RATE_LIMIT_TRUST_PROXY_HEADERS";

function envName(policyName: CallableRateLimitPolicyName, suffix: "LIMIT" | "WINDOW_SECONDS"): string {
  return `RATE_LIMIT_${policyName.toUpperCase()}_${suffix}`;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getPolicy(policyName: CallableRateLimitPolicyName): RateLimitPolicy {
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

function headerValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | null {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function splitHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function shouldTrustProxyHeaders(request: CallableRateLimitRequest): boolean {
  if (process.env[TRUST_PROXY_ENV] !== "true") return false;
  return Boolean(
    headerValue(request.rawRequest?.headers, "cf-ray") ||
      headerValue(request.rawRequest?.headers, "cf-connecting-ip"),
  );
}

function getClientIp(request: CallableRateLimitRequest): string {
  if (shouldTrustProxyHeaders(request)) {
    return (
      splitHeader(headerValue(request.rawRequest?.headers, "cf-connecting-ip")) ??
      splitHeader(headerValue(request.rawRequest?.headers, "x-forwarded-for")) ??
      request.rawRequest?.ip ??
      "unknown"
    );
  }

  return request.rawRequest?.ip ?? "unknown";
}

function bucketId(policyName: CallableRateLimitPolicyName, scope: "ip" | "user", identifier: string): string {
  return ["v1", policyName, scope, hashIdentifier(identifier || "unknown")].join(":");
}

async function consumeBucket(
  policyName: CallableRateLimitPolicyName,
  scope: "ip" | "user",
  identifier: string,
): Promise<void> {
  const policy = getPolicy(policyName);
  const now = Date.now();
  const ref = getFirestore()
    .collection("rateLimitBuckets")
    .doc(bucketId(policyName, scope, identifier));

  const result = await getFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists
      ? (snapshot.data() as Partial<{ tokens: number; updatedAt: number }>)
      : null;
    const refillRatePerMs = policy.capacity / (policy.windowSeconds * 1000);
    const previousTokens = typeof data?.tokens === "number" ? data.tokens : policy.capacity;
    const updatedAt = typeof data?.updatedAt === "number" ? data.updatedAt : now;
    const available = Math.min(
      policy.capacity,
      previousTokens + Math.max(0, now - updatedAt) * refillRatePerMs,
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
      return { ok: false, retryAfterSeconds };
    }

    transaction.set(
      ref,
      {
        tokens: available - 1,
        updatedAt: now,
        expiresAt: new Date(now + policy.windowSeconds * 1000 * 2),
      },
      { merge: true },
    );
    return { ok: true, retryAfterSeconds: 0 };
  });

  if (!result.ok) {
    logger.warn("Callable rate limit exceeded", {
      policy: policyName,
      scope,
      retryAfterSeconds: result.retryAfterSeconds,
    });
    throw new HttpsError("resource-exhausted", "Too many requests.");
  }
}

export async function enforceCallableRateLimit(
  request: CallableRateLimitRequest,
  policyName: CallableRateLimitPolicyName,
): Promise<void> {
  try {
    await consumeBucket(policyName, "ip", getClientIp(request));

    if (request.auth?.uid) {
      await consumeBucket(policyName, "user", request.auth.uid);
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }

    logger.error("Callable rate limiter unavailable", {
      policy: policyName,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    throw new HttpsError("resource-exhausted", "Too many requests.");
  }
}
