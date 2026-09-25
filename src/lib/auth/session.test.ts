import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateSessionCookie,
  mockDocGet,
  mockEnforceRateLimit,
  mockVerifyIdToken,
  mockVerifySessionCookie,
} = vi.hoisted(() => ({
  mockCreateSessionCookie: vi.fn(),
  mockDocGet: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
  mockVerifyIdToken: vi.fn(),
  mockVerifySessionCookie: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

vi.mock("@/lib/firebaseAdmin", () => ({
  adminAuth: {
    createSessionCookie: mockCreateSessionCookie,
    verifyIdToken: mockVerifyIdToken,
    verifySessionCookie: mockVerifySessionCookie,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockDocGet,
      })),
    })),
  },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

import { DELETE, POST } from "@/app/api/auth/session/route";
import { resolveSessionUser } from "./session";

function mockUserDoc(
  exists: boolean,
  data?: Record<string, unknown>,
): void {
  mockDocGet.mockResolvedValue({
    exists,
    data: () => data ?? null,
  });
}

function makeSessionHeaders(origin = "https://app.advhomemed.com"): HeadersInit {
  return {
    "Content-Type": "application/json",
    Host: "app.advhomemed.com",
    Origin: origin,
  };
}

function makePostRequest(body: unknown, origin?: string): Request {
  return new Request("http://localhost/api/auth/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: makeSessionHeaders(origin),
  });
}

function makeDeleteRequest(origin?: string): Request {
  return new Request("http://localhost/api/auth/session", {
    method: "DELETE",
    headers: makeSessionHeaders(origin),
  });
}

async function expectJsonError(
  response: Response,
  expectedStatus: number,
  expectedError: string,
): Promise<void> {
  expect(response.status).toBe(expectedStatus);
  await expect(response.json()).resolves.toEqual({ error: expectedError });
}

describe("resolveSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing user document", async () => {
    mockUserDoc(false);

    await expect(
      resolveSessionUser({
        uid: "missing-user",
        decodedEmail: "missing@example.com",
        tokenRole: "admin",
      }),
    ).resolves.toBeNull();
  });

  it("rejects an inactive user", async () => {
    mockUserDoc(true, { role: "admin", active: false });

    await expect(
      resolveSessionUser({
        uid: "inactive-user",
        decodedEmail: "inactive@example.com",
        tokenRole: "admin",
      }),
    ).resolves.toBeNull();
  });

  it("rejects a disabled user", async () => {
    mockUserDoc(true, { role: "admin", disabled: true });

    await expect(
      resolveSessionUser({
        uid: "disabled-user",
        decodedEmail: "disabled@example.com",
        tokenRole: "admin",
      }),
    ).resolves.toBeNull();
  });

  it("rejects a deleted user", async () => {
    mockUserDoc(true, { role: "admin", deleted: true });

    await expect(
      resolveSessionUser({
        uid: "deleted-user",
        decodedEmail: "deleted@example.com",
        tokenRole: "admin",
      }),
    ).resolves.toBeNull();
  });

  it("rejects an invalid role", async () => {
    mockUserDoc(true, { role: "superadmin" });

    await expect(
      resolveSessionUser({
        uid: "bad-role-user",
        decodedEmail: "bad@example.com",
        tokenRole: null,
      }),
    ).resolves.toBeNull();
  });

  it("returns an active user with a valid Firestore role", async () => {
    mockUserDoc(true, {
      role: "manager",
      active: true,
      displayName: "Manager User",
    });

    await expect(
      resolveSessionUser({
        uid: "manager-user",
        decodedEmail: "manager@example.com",
        tokenRole: "admin",
      }),
    ).resolves.toEqual({
      uid: "manager-user",
      email: "manager@example.com",
      role: "manager",
      name: "Manager User",
    });
  });
});

describe("/api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    process.env = { ...ORIGINAL_ENV };
    process.env.AUTH_TRUSTED_ORIGINS = "https://app.advhomemed.com";
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it("protects POST session creation with origin validation", async () => {
    const response = await POST(makePostRequest({ idToken: "valid-token" }, "https://evil.example"));

    await expectJsonError(response, 403, "Forbidden");
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("returns 429 when session creation exceeds the rate limit", async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    const response = await POST(makePostRequest({ idToken: "valid-token" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it("does not disclose trusted-origin configuration in CSRF failures", async () => {
    const response = await POST(makePostRequest({ idToken: "valid-token" }, "https://evil.example"));
    const body = await response.json();

    expect(body).toEqual({ error: "Forbidden" });
    expect(JSON.stringify(body)).not.toContain("app.advhomemed.com");
  });

  it("returns 401 when the token is missing", async () => {
    const response = await POST(makePostRequest({}));

    await expectJsonError(response, 401, "Missing auth token");
  });

  it("returns 401 when Firebase rejects the ID token", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("expired"));

    const response = await POST(makePostRequest({ idToken: "bad-token" }));

    await expectJsonError(response, 401, "Invalid auth token");
  });

  it("returns 403 when the verified user is not authorized", async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: "inactive-user",
      email: "inactive@example.com",
      role: "admin",
    });
    mockUserDoc(true, { role: "admin", active: false });

    const response = await POST(makePostRequest({ idToken: "valid-token" }));

    await expectJsonError(response, 403, "Forbidden");
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("creates an HttpOnly session cookie for an active user", async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: "active-user",
      email: "active@example.com",
      role: "admin",
    });
    mockUserDoc(true, { role: "admin", active: true });
    mockCreateSessionCookie.mockResolvedValue("session-cookie-value");

    const response = await POST(makePostRequest({ idToken: "valid-token" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockCreateSessionCookie).toHaveBeenCalledWith("valid-token", {
      expiresIn: 60 * 60 * 24 * 14 * 1000,
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__session=session-cookie-value");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        policyName: "login",
        scope: "user",
        identifier: "active-user",
      }),
    );
  });

  it("clears the session cookie on DELETE", async () => {
    const response = await DELETE(makeDeleteRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("protects DELETE session removal with origin validation", async () => {
    const response = await DELETE(makeDeleteRequest("https://evil.example"));

    await expectJsonError(response, 403, "Forbidden");
  });
});

describe("development bypass source guard", () => {
  it("does not contain the removed development identity", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/auth/require-user.ts"),
      "utf8",
    );

    expect(source).not.toContain(["dev", "user"].join("-"));
    expect(source).not.toContain(["Development", "User"].join(" "));
    expect(source).not.toContain(
      ["dev", "advancedhomemedical.local"].join("@"),
    );
  });
});
