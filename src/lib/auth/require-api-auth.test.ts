/**
 * Integration tests for src/lib/auth/require-api-auth.ts
 *
 * Covers the full auth workflow:
 * - requireApiAuth: token validation, user lookup, active-status check, role parsing
 * - requireApiRole: role-based access gating
 * - requireApiPermission: permission-based access gating
 *
 * Uses module-level mocks for firebaseAdmin so tests exercise real logic
 * against simulated Firebase Auth + Firestore responses.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyIdToken, mockDocGet } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockDocGet: vi.fn(),
}));

vi.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockDocGet,
      })),
    })),
  },
}));

import type { UserRole } from "@/lib/permissions/roles";
import {
  requireApiAuth,
  requireApiRole,
  requireApiPermission,
} from "./require-api-auth";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRequest(
  authorization?: string,
): { headers: { get(name: string): string | null } } {
  return {
    headers: {
      get(name: string): string | null {
        if (name === "authorization") return authorization ?? null;
        return null;
      },
    },
  };
}

function mockUserDoc(
  exists: boolean,
  data?: Record<string, unknown>,
): void {
  mockDocGet.mockResolvedValue({
    exists,
    data: () => data ?? null,
  });
}

function mockValidToken(
  uid = "test-uid",
  email = "test@example.com",
): void {
  mockVerifyIdToken.mockResolvedValue({ uid, email });
}

/** Helper: assert a failure result and return the parsed body. */
async function expectFailure(
  result: unknown,
  expectedStatus: number,
  expectedError: string,
): Promise<void> {
  expect(result).toHaveProperty("ok", false);
  const r = result as { ok: false; response: Response };
  expect(r.response.status).toBe(expectedStatus);
  const body = await r.response.json();
  expect(body.error).toBe(expectedError);
}

/** Helper: assert a success result. */
function expectSuccess(
  result: unknown,
  expected: { uid: string; email: string | null; role: UserRole },
): void {
  expect(result).toHaveProperty("ok", true);
  const r = result as {
    ok: true;
    uid: string;
    email: string | null;
    role: UserRole;
  };
  expect(r.uid).toBe(expected.uid);
  expect(r.email).toBe(expected.email);
  expect(r.role).toBe(expected.role);
}

/* ------------------------------------------------------------------ */
/*  requireApiAuth                                                     */
/* ------------------------------------------------------------------ */

describe("requireApiAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication failures", () => {
    it("returns 401 when no Authorization header is present", async () => {
      const result = await requireApiAuth(makeRequest(undefined));
      await expectFailure(result, 401, "Missing auth token");
    });

    it("returns 401 when Authorization header lacks Bearer prefix", async () => {
      const result = await requireApiAuth(makeRequest("Token abc123"));
      await expectFailure(result, 401, "Missing auth token");
    });

    it("returns 401 when Authorization header is empty Bearer", async () => {
      const result = await requireApiAuth(makeRequest("Bearer "));
      await expectFailure(result, 401, "Missing auth token");
    });

    it("returns 401 when token verification throws", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("Firebase: token expired."));
      const result = await requireApiAuth(makeRequest("Bearer bad-token"));
      await expectFailure(result, 401, "Invalid auth token");
    });

    it("returns 403 when user document does not exist in Firestore", async () => {
      mockValidToken();
      mockUserDoc(false);
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });

    it("returns 403 when user document has active=false", async () => {
      mockValidToken();
      mockUserDoc(true, { role: "technician", active: false });
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });

    it("returns 403 when user document has disabled=true", async () => {
      mockValidToken();
      mockUserDoc(true, { role: "technician", disabled: true });
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });

    it("returns 403 when user document has deleted=true", async () => {
      mockValidToken();
      mockUserDoc(true, { role: "technician", deleted: true });
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });

    it("returns 403 when user document lacks a role field", async () => {
      mockValidToken();
      mockUserDoc(true, { name: "Test User" });
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });

    it("returns 403 when user role is not a valid UserRole", async () => {
      mockValidToken();
      mockUserDoc(true, { role: "superadmin" });
      const result = await requireApiAuth(makeRequest("Bearer x"));
      await expectFailure(result, 403, "Forbidden");
    });
  });

  describe("successful authentication", () => {
    it("returns ok:true with uid, email, and role for a valid active user", async () => {
      mockValidToken("uid-1", "alice@example.com");
      mockUserDoc(true, { role: "manager" });

      const result = await requireApiAuth(makeRequest("Bearer x"));
      expectSuccess(result, { uid: "uid-1", email: "alice@example.com", role: "manager" });
    });

    it("accepts a user with email=null (no email in token)", async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: "uid-2" });
      mockUserDoc(true, { role: "admin" });

      const result = await requireApiAuth(makeRequest("Bearer x"));
      expectSuccess(result, { uid: "uid-2", email: null, role: "admin" });
    });

    it("accepts every valid UserRole", async () => {
      const roles: UserRole[] = [
        "admin",
        "manager",
        "technician",
        "billing",
        "read-only",
        "staff",
        "tank",
      ];

      for (const role of roles) {
        vi.clearAllMocks();
        mockVerifyIdToken.mockResolvedValue({ uid: `u-${role}`, email: `${role}@t.com` });
        mockUserDoc(true, { role });

        const result = await requireApiAuth(makeRequest("Bearer x"));
        expectSuccess(result, { uid: `u-${role}`, email: `${role}@t.com`, role });
      }
    });
  });
});

/* ------------------------------------------------------------------ */
/*  requireApiRole                                                     */
/* ------------------------------------------------------------------ */

describe("requireApiRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits to 401 when not authenticated", async () => {
    const result = await requireApiRole(makeRequest(undefined), ["admin"]);
    await expectFailure(result, 401, "Missing auth token");
  });

  it("returns 403 when user role is not in the allowed list", async () => {
    mockValidToken("uid", "tech@t.com");
    mockUserDoc(true, { role: "technician" });

    const result = await requireApiRole(makeRequest("Bearer x"), [
      "admin",
      "manager",
    ]);
    await expectFailure(result, 403, "Forbidden");
  });

  it("returns ok:true when user role is in the allowed list", async () => {
    mockValidToken("uid", "admin@t.com");
    mockUserDoc(true, { role: "admin" });

    const result = await requireApiRole(makeRequest("Bearer x"), [
      "admin",
      "manager",
    ]);
    expectSuccess(result, { uid: "uid", email: "admin@t.com", role: "admin" });
  });

  it("accepts a single-element allowed-roles list", async () => {
    mockValidToken("uid", "tank@t.com");
    mockUserDoc(true, { role: "tank" });

    const result = await requireApiRole(makeRequest("Bearer x"), ["tank"]);
    expectSuccess(result, { uid: "uid", email: "tank@t.com", role: "tank" });
  });
});

/* ------------------------------------------------------------------ */
/*  requireApiPermission                                               */
/* ------------------------------------------------------------------ */

describe("requireApiPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits to 401 when not authenticated", async () => {
    const result = await requireApiPermission(
      makeRequest(undefined),
      "inventory:read",
    );
    await expectFailure(result, 401, "Missing auth token");
  });

  it("returns 403 when user role lacks the required permission", async () => {
    mockValidToken("uid", "ro@t.com");
    mockUserDoc(true, { role: "read-only" });

    const result = await requireApiPermission(
      makeRequest("Bearer x"),
      "inventory:write",
    );
    await expectFailure(result, 403, "Forbidden");
  });

  it("returns ok:true when user role has the required permission", async () => {
    mockValidToken("uid", "admin@t.com");
    mockUserDoc(true, { role: "admin" });

    const result = await requireApiPermission(
      makeRequest("Bearer x"),
      "inventory:write",
    );
    expectSuccess(result, { uid: "uid", email: "admin@t.com", role: "admin" });
  });

  it("returns 403 when one of multiple required permissions is missing", async () => {
    mockValidToken("uid", "tech@t.com");
    mockUserDoc(true, { role: "technician" });

    const result = await requireApiPermission(
      makeRequest("Bearer x"),
      "inventory:read",
      "admin:users",
    );
    await expectFailure(result, 403, "Forbidden");
  });

  it("returns ok:true when user role has all required permissions", async () => {
    mockValidToken("uid", "admin@t.com");
    mockUserDoc(true, { role: "admin" });

    const result = await requireApiPermission(
      makeRequest("Bearer x"),
      "inventory:write",
      "patients:write",
      "reports:delete",
    );
    expectSuccess(result, { uid: "uid", email: "admin@t.com", role: "admin" });
  });
});
