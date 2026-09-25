import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockEnforceRateLimit,
  mockExecuteQuery,
  mockGetCollectionsSummary,
  mockGetDocument,
  mockVerifyChatGptApiKey,
} = vi.hoisted(() => ({
  mockEnforceRateLimit: vi.fn(),
  mockExecuteQuery: vi.fn(),
  mockGetCollectionsSummary: vi.fn(),
  mockGetDocument: vi.fn(),
  mockVerifyChatGptApiKey: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/chatgpt-bridge/auth", () => ({
  verifyChatGptApiKey: mockVerifyChatGptApiKey,
}));

vi.mock("@/lib/chatgpt-bridge/queries", () => ({
  executeQuery: mockExecuteQuery,
  getCollectionsSummary: mockGetCollectionsSummary,
  getDocument: mockGetDocument,
}));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("https://app.advhomemed.com/api/chatgpt", {
    method: "POST",
    headers: {
      Authorization: "Bearer chatgpt-key",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("/api/chatgpt rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockVerifyChatGptApiKey.mockReturnValue({ ok: true });
    mockGetCollectionsSummary.mockResolvedValue({ collections: [] });
  });

  it("returns 429 before API key verification when the IP bucket is exhausted", async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Retry-After": "45" },
      }),
    );

    const response = await POST(request({ mode: "collections" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(mockVerifyChatGptApiKey).not.toHaveBeenCalled();
  });

  it("applies an API-key bucket after successful authentication", async () => {
    const response = await POST(request({ mode: "collections" }));

    expect(response.status).toBe(200);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        policyName: "ai",
        scope: "api-key",
        identifier: "Bearer chatgpt-key",
      }),
    );
  });
});
