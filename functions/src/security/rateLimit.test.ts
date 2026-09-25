import { beforeEach, describe, expect, it, vi } from "vitest";

type BucketRecord = {
  tokens: number;
  updatedAt: number;
};

const { buckets } = vi.hoisted(() => ({
  buckets: new Map<string, BucketRecord>(),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (
      callback: (transaction: {
        get: (ref: { id: string }) => Promise<{ exists: boolean; data: () => BucketRecord | undefined }>;
        set: (ref: { id: string }, data: BucketRecord) => void;
      }) => Promise<unknown>,
    ) =>
      callback({
        async get(ref) {
          const data = buckets.get(ref.id);
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        set(ref, data) {
          buckets.set(ref.id, {
            tokens: data.tokens,
            updatedAt: data.updatedAt,
          });
        },
      }),
  }),
}));

vi.mock("firebase-functions", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { HttpsError } from "firebase-functions/v2/https";
import { enforceCallableRateLimit } from "./rateLimit";

const ORIGINAL_ENV = { ...process.env };

function request(uid = "user-1", ip = "198.51.100.10") {
  return {
    auth: { uid },
    rawRequest: {
      ip,
      headers: {},
    },
  };
}

describe("enforceCallableRateLimit", () => {
  beforeEach(() => {
    buckets.clear();
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.RATE_LIMIT_ADMIN_LIMIT = "2";
    process.env.RATE_LIMIT_ADMIN_WINDOW_SECONDS = "10";
    vi.spyOn(Date, "now").mockReturnValue(1_000);
  });

  it("allows normal callable traffic", async () => {
    await expect(enforceCallableRateLimit(request(), "admin")).resolves.toBeUndefined();
    await expect(enforceCallableRateLimit(request(), "admin")).resolves.toBeUndefined();
  });

  it("blocks bursts with a generic resource-exhausted error", async () => {
    await enforceCallableRateLimit(request(), "admin");
    await enforceCallableRateLimit(request(), "admin");

    await expect(enforceCallableRateLimit(request(), "admin")).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Too many requests.",
    });
  });

  it("separates user buckets", async () => {
    await enforceCallableRateLimit(request("user-1"), "admin");
    await enforceCallableRateLimit(request("user-1"), "admin");

    await expect(
      enforceCallableRateLimit(request("user-2", "198.51.100.11"), "admin"),
    ).resolves.toBeUndefined();
  });

  it("refills after the configured window", async () => {
    await enforceCallableRateLimit(request(), "admin");
    await enforceCallableRateLimit(request(), "admin");

    vi.mocked(Date.now).mockReturnValue(11_000);

    await expect(enforceCallableRateLimit(request(), "admin")).resolves.toBeUndefined();
  });

  it("uses a generic error type", async () => {
    await enforceCallableRateLimit(request(), "admin");
    await enforceCallableRateLimit(request(), "admin");

    try {
      await enforceCallableRateLimit(request(), "admin");
      throw new Error("Expected rate limit failure");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpsError);
      expect((error as HttpsError).message).toBe("Too many requests.");
    }
  });
});
