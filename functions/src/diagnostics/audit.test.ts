import {beforeEach, describe, expect, it, vi} from "vitest";

const addMock = vi.hoisted(() => vi.fn(() => Promise.resolve({id: "audit-id"})));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  },
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: addMock,
    })),
  })),
}));

import {writeDiagnosticAudit} from "./audit.js";

describe("diagnostic audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores only sanitized parameters and result counts, never evidence content", async () => {
    await writeDiagnosticAudit({
      actorUid: "admin-uid",
      tool: "repo_read",
      params: {
        path: "src/app.ts",
        startLine: 1,
        endLine: 2,
        returnedSource: "const secret = 'do-not-store';",
        authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
      },
      success: true,
      resultCount: 2,
    });

    const calls = addMock.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const written = calls[0]?.[0] ?? {};
    expect(written).toMatchObject({
      actorUid: "admin-uid",
      tool: "repo_read",
      success: true,
      resultCount: 2,
      createdAt: "SERVER_TIMESTAMP",
    });
    expect(JSON.stringify(written)).not.toContain("do-not-store");
    expect(JSON.stringify(written)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(written).not.toHaveProperty("result");
    expect(written).not.toHaveProperty("evidence");
  });
});
