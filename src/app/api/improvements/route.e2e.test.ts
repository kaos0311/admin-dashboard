/**
 * End-to-end test for /api/improvements
 *
 * Covers the full proposal lifecycle through the real route handlers:
 * - Auth gating (401/403)
 * - Input validation (400)
 * - Create -> List -> Approve -> Apply
 * - Create -> Reject (with and without reason)
 * - State-machine transition guards (invalid actions on wrong status)
 * - Edge cases: empty body, missing fields, bad tokens, non-existent proposal
 *
 * Uses the same firebaseAdmin mock pattern as require-api-auth.test.ts
 * so auth flows are exercised through the real requireApiRole guard.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/* ------------------------------------------------------------------ */
/*  Firebase mocks (hoisted — runs before any import)                  */
/* ------------------------------------------------------------------ */

let nextDocId = 0;

const { mockVerifyIdToken, mockDocGet, mockDocSet, mockDocUpdate, mockCollectionGet } =
  vi.hoisted(() => {
    const mockVerifyIdToken = vi.fn();
    const mockDocGet = vi.fn();
    const mockDocSet = vi.fn();
    const mockDocUpdate = vi.fn();
    const mockCollectionGet = vi.fn();

    return { mockVerifyIdToken, mockDocGet, mockDocSet, mockDocUpdate, mockCollectionGet };
  });

vi.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
  adminDb: {
    collection: vi.fn((name: string) => {
      const collectionName = name;
      const coll: Record<string, unknown> = {
        doc: vi.fn((docId?: string) => {
          const id = docId ?? `auto-${++nextDocId}`;
          return {
            id,
            get: vi.fn(() => mockDocGet(collectionName, id)),
            set: vi.fn((data: Record<string, unknown>) => mockDocSet(collectionName, id, data)),
            update: vi.fn((data: Record<string, unknown>) => mockDocUpdate(collectionName, id, data)),
          };
        }),
        where: vi.fn(() => coll),
        orderBy: vi.fn(() => coll),
        limit: vi.fn(() => coll),
        get: vi.fn(() => mockCollectionGet(collectionName)),
      };
      return coll;
    }),
  },
}));

import { GET, PATCH, POST } from "./route";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TEST_ADMIN_UID = "e2e-admin-uid";
const TEST_ADMIN_EMAIL = "e2e-admin@test.local";

function makeRequest(
  method: string,
  body?: unknown,
  token?: string,
): NextRequest {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");

  const url = new URL("http://localhost/api/improvements");
  if (method === "GET") url.searchParams.set("status", "pending");

  return new NextRequest(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function resolveToken(uid = TEST_ADMIN_UID, email = TEST_ADMIN_EMAIL): void {
  mockVerifyIdToken.mockResolvedValue({ uid, email });
}

function rejectToken(error = "Firebase: token expired."): void {
  mockVerifyIdToken.mockRejectedValue(new Error(error));
}

/**
 * Configure mockDocGet to return specific data for a given collection/doc pair.
 * Call with `null` data to simulate a non-existent document.
 * After the matched response, falls back to a default "does not exist" behavior.
 */
function mockDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown> | null,
): void {
  const originalImpl = mockDocGet.getMockImplementation();

  mockDocGet.mockImplementation((coll: string, id: string) => {
    if (coll === collection && id === docId) {
      return Promise.resolve({
        exists: data !== null,
        data: () => data,
      });
    }
    // Fall through to previous implementation or default
    if (originalImpl) {
      return originalImpl(coll, id);
    }
    return Promise.resolve({ exists: false, data: () => null });
  });
}

/**
 * Set up a default mockDocGet that returns a valid admin user doc
 * for the standard test UID and "does not exist" for everything else.
 */
function withValidAdminUser(): void {
  mockDocGet.mockImplementation((coll: string, id: string) => {
    if (coll === "users" && id === TEST_ADMIN_UID) {
      return Promise.resolve({
        exists: true,
        data: () => ({
          role: "admin",
          active: true,
          disabled: false,
          deleted: false,
        }),
      });
    }
    return Promise.resolve({ exists: false, data: () => null });
  });
}

function withRole(role: string): void {
  mockDocGet.mockImplementation((coll: string, id: string) => {
    if (coll === "users" && id === TEST_ADMIN_UID) {
      return Promise.resolve({
        exists: true,
        data: () => ({
          role,
          active: true,
          disabled: false,
          deleted: false,
        }),
      });
    }
    return Promise.resolve({ exists: false, data: () => null });
  });
}

function withInactiveUser(inactiveField: "active" | "disabled" | "deleted"): void {
  const base = { role: "admin", active: true, disabled: false, deleted: false };
  if (inactiveField === "active") base.active = false;
  if (inactiveField === "disabled") base.disabled = true;
  if (inactiveField === "deleted") base.deleted = true;

  mockDocGet.mockImplementation((coll: string, id: string) => {
    if (coll === "users" && id === TEST_ADMIN_UID) {
      return Promise.resolve({
        exists: true,
        data: () => ({ ...base }),
      });
    }
    return Promise.resolve({ exists: false, data: () => null });
  });
}

function noUserDoc(): void {
  mockDocGet.mockResolvedValue({ exists: false, data: () => null });
}

async function getJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  return JSON.parse(text) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Improvements API — full workflow E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextDocId = 0;
  });

  /* ---------------------------------------------------------------- */
  /*  Auth gating                                                      */
  /* ---------------------------------------------------------------- */

  describe("auth gating", () => {
    it("POST returns 401 when no Authorization header is present", async () => {
      rejectToken();
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }),
      );
      expect(response.status).toBe(401);
      const body = await getJson(response);
      expect(body.error).toBe("Missing auth token");
    });

    it("POST returns 401 when token is invalid", async () => {
      rejectToken();
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "bad-token"),
      );
      expect(response.status).toBe(401);
      const body = await getJson(response);
      expect(body.error).toBe("Invalid auth token");
    });

    it("POST returns 401 when Authorization header lacks Bearer prefix", async () => {
      const headers = new Headers();
      headers.set("authorization", "Token abc");
      headers.set("content-type", "application/json");
      const url = new URL("http://localhost/api/improvements");
      const request = new NextRequest(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "x", description: "y", category: "api", priority: "low" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("GET returns 401 when no Authorization header is present", async () => {
      rejectToken();
      const response = await GET(makeRequest("GET"));
      expect(response.status).toBe(401);
    });

    it("PATCH returns 401 when no Authorization header is present", async () => {
      rejectToken();
      const response = await PATCH(makeRequest("PATCH", { id: "x", action: "approve" }));
      expect(response.status).toBe(401);
    });

    it("returns 403 when user document does not exist", async () => {
      resolveToken();
      noUserDoc();
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "valid-token"),
      );
      expect(response.status).toBe(403);
      const body = await getJson(response);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when user role lacks required permissions (read-only)", async () => {
      resolveToken();
      withRole("read-only");
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "valid-token"),
      );
      expect(response.status).toBe(403);
      const body = await getJson(response);
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when user is inactive (active=false)", async () => {
      resolveToken();
      withInactiveUser("active");
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "valid-token"),
      );
      expect(response.status).toBe(403);
    });

    it("returns 403 when user is disabled", async () => {
      resolveToken();
      withInactiveUser("disabled");
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "valid-token"),
      );
      expect(response.status).toBe(403);
    });

    it("returns 403 when user is deleted", async () => {
      resolveToken();
      withInactiveUser("deleted");
      const response = await POST(
        makeRequest("POST", { title: "x", description: "y", category: "api", priority: "low" }, "valid-token"),
      );
      expect(response.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Input validation                                                  */
  /* ---------------------------------------------------------------- */

  describe("input validation", () => {
    beforeEach(() => {
      resolveToken();
      withValidAdminUser();
    });

    it("POST returns 400 when title is missing", async () => {
      const response = await POST(makeRequest("POST", { description: "Only description" }, "valid-token"));
      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("Title");
    });

    it("POST returns 400 when description is missing", async () => {
      const response = await POST(makeRequest("POST", { title: "Only title" }, "valid-token"));
      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("Title");
    });

    it("POST returns 400 for invalid category", async () => {
      const response = await POST(
        makeRequest("POST", { title: "Test", description: "Test desc", category: "invalid" }, "valid-token"),
      );
      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("category");
    });

    it("POST returns 400 for invalid priority", async () => {
      const response = await POST(
        makeRequest("POST", { title: "Test", description: "Test desc", category: "ui", priority: "urgent" }, "valid-token"),
      );
      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("priority");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Successful workflow: Create -> List -> Approve -> Apply           */
  /* ---------------------------------------------------------------- */

  describe("full lifecycle: create -> list -> approve -> apply", () => {
    beforeEach(() => {
      resolveToken();
      withValidAdminUser();
    });

    it("creates a new proposal (POST returns 201 with proposal id)", async () => {
      const response = await POST(
        makeRequest(
          "POST",
          {
            title: "Add dark mode",
            description: "Users requested a dark theme option",
            category: "ui",
            priority: "medium",
            proposedChanges: "New theme toggle in settings",
            estimatedImpact: "Low — CSS variables only",
          },
          "valid-token",
        ),
      );

      expect(response.status).toBe(201);
      const body = await getJson(response);
      expect(body).toHaveProperty("id");
      expect(typeof body.id).toBe("string");
    });

    it("lists pending proposals (GET returns 200 with proposals array)", async () => {
      const fakeDocs = [
        {
          id: "proposal-1",
          data: () => ({
            title: "Test proposal 1",
            description: "First proposal",
            category: "api",
            priority: "high",
            status: "pending",
            createdAt: { toDate: () => new Date("2026-06-01") },
            updatedAt: { toDate: () => new Date("2026-06-01") },
            appliedAt: null,
          }),
        },
        {
          id: "proposal-2",
          data: () => ({
            title: "Test proposal 2",
            description: "Second proposal",
            category: "ui",
            priority: "low",
            status: "pending",
            createdAt: { toDate: () => new Date("2026-06-02") },
            updatedAt: { toDate: () => new Date("2026-06-02") },
            appliedAt: null,
          }),
        },
      ];

      mockCollectionGet.mockResolvedValue({ docs: fakeDocs, empty: false });

      const response = await GET(makeRequest("GET", undefined, "valid-token"));
      expect(response.status).toBe(200);
      const body = (await getJson(response)) as { proposals: Array<{ id: string; title: string }> };
      expect(body.proposals).toBeDefined();
      expect(body.proposals).toHaveLength(2);
      expect(body.proposals[0].title).toBe("Test proposal 1");
      expect(body.proposals[1].title).toBe("Test proposal 2");
    });

    it("approves a pending proposal (PATCH returns 200)", async () => {
      mockDoc("improvementProposals", "approve-me", {
        title: "Approve me",
        description: "Ready for approval",
        category: "api",
        priority: "high",
        status: "pending",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });

      const response = await PATCH(makeRequest("PATCH", { id: "approve-me", action: "approve" }, "valid-token"));

      expect(response.status).toBe(200);
      const body = await getJson(response);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("approved");

      expect(mockDocUpdate).toHaveBeenCalledWith(
        "improvementProposals",
        "approve-me",
        expect.objectContaining({ status: "approved" }),
      );
    });

    it("applies an approved proposal (PATCH returns 200)", async () => {
      mockDoc("improvementProposals", "apply-me", {
        title: "Apply me",
        description: "Already approved",
        category: "api",
        priority: "high",
        status: "approved",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });

      const response = await PATCH(makeRequest("PATCH", { id: "apply-me", action: "apply" }, "valid-token"));

      expect(response.status).toBe(200);
      const body = await getJson(response);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("applied");

      expect(mockDocUpdate).toHaveBeenCalledWith(
        "improvementProposals",
        "apply-me",
        expect.objectContaining({ status: "applied" }),
      );
    });

    it("rejects a pending proposal with rejection reason (PATCH returns 200)", async () => {
      mockDoc("improvementProposals", "reject-me", {
        title: "Reject me",
        description: "Ready for rejection",
        category: "api",
        priority: "medium",
        status: "pending",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      });

      const response = await PATCH(
        makeRequest(
          "PATCH",
          { id: "reject-me", action: "reject", rejectionReason: "Not aligned with current priorities" },
          "valid-token",
        ),
      );

      expect(response.status).toBe(200);
      const body = await getJson(response);
      expect(body.ok).toBe(true);
      expect(body.status).toBe("rejected");

      expect(mockDocUpdate).toHaveBeenCalledWith(
        "improvementProposals",
        "reject-me",
        expect.objectContaining({ status: "rejected", rejectionReason: "Not aligned with current priorities" }),
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /*  State-machine transition guards                                  */
  /* ---------------------------------------------------------------- */

  describe("state-machine guards", () => {
    beforeEach(() => {
      resolveToken();
      withValidAdminUser();
    });

    it("rejects PATCH on a non-existent proposal (404)", async () => {
      mockDoc("improvementProposals", "does-not-exist", null);

      const response = await PATCH(makeRequest("PATCH", { id: "does-not-exist", action: "approve" }, "valid-token"));
      expect(response.status).toBe(404);
    });

    it("rejects rejection of a non-pending proposal", async () => {
      mockDoc("improvementProposals", "already-rejected", {
        status: "rejected",
      });

      const response = await PATCH(
        makeRequest("PATCH", { id: "already-rejected", action: "reject", rejectionReason: "Try again" }, "valid-token"),
      );

      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("pending");
    });

    it("rejects approval of an already-approved proposal", async () => {
      mockDoc("improvementProposals", "already-approved", { status: "approved" });

      const response = await PATCH(makeRequest("PATCH", { id: "already-approved", action: "approve" }, "valid-token"));
      expect(response.status).toBe(400);
    });

    it("rejects apply on a pending (not approved) proposal", async () => {
      mockDoc("improvementProposals", "still-pending", { status: "pending" });

      const response = await PATCH(makeRequest("PATCH", { id: "still-pending", action: "apply" }, "valid-token"));
      expect(response.status).toBe(400);
    });

    it("rejects apply on a rejected proposal", async () => {
      mockDoc("improvementProposals", "rejected-apply", { status: "rejected" });

      const response = await PATCH(makeRequest("PATCH", { id: "rejected-apply", action: "apply" }, "valid-token"));
      expect(response.status).toBe(400);
    });

    it("requires rejectionReason when rejecting", async () => {
      mockDoc("improvementProposals", "no-reason", { status: "pending" });

      const response = await PATCH(makeRequest("PATCH", { id: "no-reason", action: "reject" }, "valid-token"));
      expect(response.status).toBe(400);
      const body = await getJson(response);
      expect(body.error).toContain("reason");
    });

    it("rejects invalid PATCH action", async () => {
      mockDoc("improvementProposals", "some-proposal", { status: "pending" });

      const response = await PATCH(makeRequest("PATCH", { id: "some-proposal", action: "destroy" }, "valid-token"));
      expect(response.status).toBe(400);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  describe("edge cases", () => {
    it("handles empty POST body gracefully (returns an error, not a crash)", async () => {
      resolveToken();
      withValidAdminUser();

      const headers = new Headers();
      headers.set("authorization", "Bearer valid-token");
      headers.set("content-type", "application/json");
      const url = new URL("http://localhost/api/improvements");
      const request = new NextRequest(url.toString(), {
        method: "POST",
        headers,
        body: "",
      });

      const response = await POST(request);
      // The route catches JSON parse errors and returns 500 (not a crash)
      expect(response.status).toBe(500);
    });

    it("handles PATCH with missing id gracefully (400)", async () => {
      resolveToken();
      withValidAdminUser();

      const headers = new Headers();
      headers.set("authorization", "Bearer valid-token");
      headers.set("content-type", "application/json");
      const url = new URL("http://localhost/api/improvements");
      const request = new NextRequest(url.toString(), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "approve" }),
      });

      const response = await PATCH(request);
      expect(response.status).toBe(400);
    });
  });
});
