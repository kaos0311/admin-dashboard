import {beforeEach, describe, expect, it, vi} from "vitest";

const auditMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const requireAdminMock = vi.hoisted(() => vi.fn(() => Promise.resolve("admin")));
const rateLimitMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const runDiagnosticRequestMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      tool: "repo_status",
      evidence: {status: "VERIFIED", source: "test", checkedAt: "now"},
      result: {
        provider: {
          providerType: "LOCAL_WORKTREE",
          repository: "test",
          snapshot: "local-worktree:abc",
          branch: "ai-development",
          commit: "abc",
          evidenceTimestamp: "now",
        },
        branch: "ai-development",
        head: "abc",
        clean: true,
        dirtyFiles: 0,
      },
      resultCount: 1,
    }),
  ),
);

vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = "HttpsError";
    }
  },
}));

vi.mock("../auth/roles", () => ({
  requireCallableAdmin: requireAdminMock,
}));

vi.mock("../security/rateLimit", () => ({
  enforceCallableRateLimit: rateLimitMock,
}));

vi.mock("./audit", () => ({
  writeDiagnosticAudit: auditMock,
}));

vi.mock("./service", () => ({
  runDiagnosticRequest: runDiagnosticRequestMock,
}));

import {jarvisDiagnosticsCallable} from "./callable.js";

describe("jarvisDiagnosticsCallable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue("admin");
  });

  it("rejects unauthorized callers through canonical callable admin authority", async () => {
    requireAdminMock.mockRejectedValue(new Error("permission-denied"));

    await expect(
      (jarvisDiagnosticsCallable as unknown as (request: unknown) => Promise<unknown>)({
        data: {tool: "repo_status"},
      }),
    ).rejects.toThrow(/permission-denied/);

    expect(requireAdminMock).toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("runs a valid diagnostic and records only audit metadata", async () => {
    const result = await (jarvisDiagnosticsCallable as unknown as (request: unknown) => Promise<unknown>)({
      auth: {uid: "admin-uid", token: {role: "admin"}},
      data: {tool: "repo_status"},
    });

    expect(result).toMatchObject({
      tool: "repo_status",
      evidence: {status: "VERIFIED"},
      result: {
        provider: {
          providerType: "LOCAL_WORKTREE",
        },
      },
      resultCount: 1,
    });
    expect(auditMock).toHaveBeenCalledWith({
      actorUid: "admin-uid",
      tool: "repo_status",
      params: {},
      success: true,
      resultCount: 1,
    });
  });
});
