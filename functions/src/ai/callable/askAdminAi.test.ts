/**
 * Mocked-model integration tests for the Jarvis reporting contract.
 *
 * Proves the end-to-end askAdminAi path enforces:
 *   - capped sample -> actualCount unknown
 *   - true aggregate count -> actual count allowed
 *   - field-name similarity alone does NOT confirm a join
 *   - real matching keys produce verified join counts
 *   - contradictions are detected
 *   - unsupported "confirmed/proven/actual" language is rejected/downgraded
 *   - unsafe remediation recommendation is gated
 *   - PHI redaction still works
 *   - generated CSV/report uses the same classifications/count semantics
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  failingSampleCollections: new Set<string>(),
}));

const mockRunDiagnosticRequest = vi.hoisted(() => vi.fn());

vi.mock("firebase-admin/app", () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));

const mockSnapshot = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs,
  get: vi.fn(() => Promise.resolve({ docs })),
});

const mockCollection = (
  collectionName: string,
  records: Array<Record<string, unknown>>,
  countValue: number | null = null
) => {
  const self = () => self;
  self.doc = vi.fn((id: string) => {
    const record = records.find((item) => item.__id === id);
    return {
      collectionName,
      id,
      get: vi.fn(() =>
        Promise.resolve({
          id,
          exists: Boolean(record),
          data: () => record ?? { generatedAtLabel: "2025-01-01" },
        })
      ),
    };
  });
  self.limit = vi.fn(() => ({
    get: vi.fn(() =>
      mockState.failingSampleCollections.has(collectionName)
        ? Promise.reject(new Error(`sample failed for ${collectionName}`))
        : Promise.resolve(
            mockSnapshot(
              records.map((data, index) => ({
                id: `doc-${index}`,
                data: () => data,
              }))
            )
        )
    ),
  }));
  self.select = vi.fn(() => ({
    limit: vi.fn(() => ({
      get: vi.fn(() =>
        Promise.resolve(
          mockSnapshot(
            records.map((data, index) => ({
              id: `doc-${index}`,
              data: () => data,
            }))
          )
        )
      ),
    })),
  }));
  self.orderBy = vi.fn(() => ({
    limit: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve(mockSnapshot([]))),
    })),
  }));
  self.where = vi.fn(() => ({
    limit: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve(mockSnapshot([]))),
    })),
  }));
  self.count = vi.fn(() => ({
    get: vi.fn(() =>
      Promise.resolve({
        data: () => ({ count: countValue === null ? null : countValue ?? records.length }),
      })
    ),
  }));
  self.add = vi.fn(() => Promise.resolve({ id: "audit-log-id" }));
  return self;
};

vi.mock("firebase-admin/firestore", () => {
  const collections: Record<string, Array<Record<string, unknown>>> = {
    users: [
      { __id: "test-user", uid: "test-user", role: "admin", active: true, disabled: false, deleted: false },
    ],
    patients: [
      { __id: "pat-join-001", patientId: "PAT-JOIN-001", patientName: "Alice Smith", dob: "1980-01-01", phone: "555-1111", insurance: "Acme" },
      { __id: "pat-join-002", patientId: "PAT-JOIN-002", patientName: "Bob Jones", dob: "1975-05-05", phone: "555-2222", insurance: "Beta" },
      { __id: "pat-join-003", patientId: "PAT-JOIN-003", patientName: "Carol White", dob: "1990-09-09", phone: "555-3333", insurance: "Gamma" },
    ],
    orders: [
      { __id: "order-1", patientName: "alice smith", status: "active", productType: "DME" },
      { __id: "order-2", patientName: "BOB  JONES", status: "active", productType: "DME" },
      { __id: "order-3", patientName: "Dan Brown", status: "active", productType: "DME" },
    ],
    rentals: [
      { __id: "rental-1", patientId: "PAT-JOIN-001", patientName: "Alice Smith", status: "active" },
    ],
    wipRecords: [
      { __id: "wip-1", patientName: "Unknown", status: "open" },
    ],
    analytics: [],
    auditLogs: [],
    importJobs: [],
    inventory: [],
    products: [],
    hospicePatients: [],
    insuranceRecords: [],
    insurancePatients: [],
    patientDeliveryTickets: [],
    patientAuthorizations: [
      { patientId: "PAT-JOIN-002", status: "active" },
      { patientId: "PAT-JOIN-MISSING", status: "active" },
    ],
    shopItems: [],
    shopCostOfGoodsSold: [],
    shopInventoryLots: [],
    shopInventorySerials: [],
  };

  const aggregateCounts: Record<string, number | null> = {
    patients: 3,
    orders: 3,
    rentals: 1,
    patientAuthorizations: 2,
  };

  const db = {
    collection: (name: string) =>
      mockCollection(name, collections[name] ?? [], aggregateCounts[name] ?? null),
    getAll: vi.fn(
      async (...refs: Array<{ collectionName: string; id: string }>) =>
        refs.map((ref) => {
          const records = collections[ref.collectionName] ?? [];
          const found = records.find((record) => record.__id === ref.id);
          return {
            id: ref.id,
            exists: Boolean(found),
            data: () => found ?? {},
          };
        })
    ),
  };

  return {
    getFirestore: vi.fn(() => db),
    FieldValue: {
      serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    },
  };
});

vi.mock("firebase-functions/v2/https", () => ({
  onCall: vi.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError {
    code: string;
    message: string;
    constructor(code: string, message: string) {
      this.code = code;
      this.message = message;
    }
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: vi.fn((_name: string) => ({ value: () => "test-key" })),
}));

const mockResponsesCreate = vi.fn(() =>
  Promise.resolve({
    output_text: "mocked openai response",
  })
);

vi.mock("openai", () => {
  return {
    default: class OpenAI {
      constructor(public apiKey: string) {}
      responses = { create: mockResponsesCreate };
    },
  };
});

vi.mock("../../security/rateLimit", () => ({
  enforceCallableRateLimit: vi.fn(),
}));

vi.mock("../../diagnostics/service", () => ({
  runDiagnosticRequest: mockRunDiagnosticRequest,
}));

vi.mock("../phiSafety", () => ({
  createPhiAlert: vi.fn(() => Promise.resolve("alert-id")),
  redactPhi: vi.fn((text: string) => text),
  scanTextForPhi: vi.fn(() => []),
}));

vi.mock("../prompts/adminSystemPrompt", () => ({
  buildJarvisSystemPrompt: vi.fn(() => "JARVIS SYSTEM PROMPT"),
}));

vi.mock("../services/auditContext", () => ({
  buildAuditContext: vi.fn(() => ({
    recentAuditLogs: [],
    auditSampleNote: "sample note",
    evidence: [],
  })),
}));

vi.mock("../tools/reportInsights", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tools/reportInsights")>();
  return {
    ...actual,
    csvEscape: vi.fn((value: unknown) => String(value ?? "")),
    REPORT_CSV_HEADER: actual.REPORT_CSV_HEADER,
  };
});

vi.mock("../prompts/analyticsPrompt", () => ({
  buildAnalyticsContextSection: vi.fn(() => "analytics section"),
}));

vi.mock("../services/openaiClient", () => ({
  createOpenAiClient: vi.fn(() => ({
    responses: { create: mockResponsesCreate },
  })),
  buildJarvisResponsesParams: vi.fn((input: unknown) => input),
  JARVIS_MODEL: "gpt-4.1-mini",
  JARVIS_TEMPERATURE: 0.25,
}));

vi.mock("../services/aiLogger", () => ({
  buildAiAuditLogPayload: vi.fn((payload: Record<string, unknown>) => ({ ...payload, createdAt: "SERVER_TIMESTAMP" })),
}));

import { askAdminAi } from "./askAdminAi";
import { buildJarvisSystemPrompt } from "../prompts/adminSystemPrompt";
import { buildReportCsv } from "../tools/reportInsights";
import {
  canRecommendAction,
  findCountContradictions,
  summarizeSample,
  verifyJoin,
} from "../types/reporting";

function getLastOpenAiParams() {
  const responseCalls = mockResponsesCreate.mock.calls as unknown as Array<
    [Record<string, unknown>]
  >;
  return responseCalls.at(-1)?.[0] ?? {};
}

function getLastUserPayload() {
  const params = getLastOpenAiParams() as { user?: string };
  return JSON.parse(params.user ?? "{}") as {
    question?: string;
    intent?: string;
    context?: {
      operationsOverview?: {
        unavailableContext?: Array<{
          collection: string;
          reason: string;
          classification: string;
          evidenceRef: string;
        }>;
        summaries?: Array<{ collection: string; classification: string }>;
        joins?: unknown[];
      };
      diagnosticsOverview?: {
        results?: Array<{
          evidence: {
            status: string;
          };
        }>;
      };
    };
    webSearchInstructions?: unknown;
  };
}

describe("askAdminAi reporting contract integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.failingSampleCollections.clear();
    mockResponsesCreate.mockResolvedValue({ output_text: "The sample suggests there are likely many records." });
    mockRunDiagnosticRequest.mockImplementation(async (request: {tool: string}) => {
      if (request.tool === "repo_status") {
        return {
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
        };
      }

      if (request.tool === "repo_search") {
        return {
          tool: "repo_search",
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
            hits: [
              {
                path: "functions/src/ai/callable/askAdminAi.ts",
                line: 1,
                preview: "export const askAdminAi = onCall(...)",
              },
            ],
            resultCount: 1,
            truncated: false,
          },
          resultCount: 1,
        };
      }

      return {
        tool: request.tool,
        evidence: {status: "VERIFIED", source: "test", checkedAt: "now"},
        result: null,
        resultCount: 0,
      };
    });
  });

  it("uses buildJarvisSystemPrompt instead of inline prompt", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "How many patients?" },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    expect(buildJarvisSystemPrompt).toHaveBeenCalled();
  });

  it("builds operations context with summaries from limited queries", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Give me an operations overview" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string; intent: string; collectionsUsed: string[] }>)(request));

    expect(result.answer).toBe("The sample suggests there are likely many records.");
    expect(result.intent).toBe("general");
    expect(result.collectionsUsed).toContain("patients");
  });

  it("labels a capped 1000-doc query as sampled with unknown actual", () => {
    const summary = summarizeSample("patients", Array.from({ length: 1000 }, (_, i) => ({ id: `p${i}` })), 1000);

    expect(summary.count.sampledCount).toBe(1000);
    expect(summary.count.actualCount).toBeNull();
    expect(summary.count.method).toBe("limited_query");
    expect(summary.classification).toBe("UNKNOWN");
  });

  it("reports an aggregate count when a true count ran", () => {
    const summary = summarizeSample("patients", Array.from({ length: 1000 }, (_, i) => ({ id: `p${i}` })), 1000, {
      aggregateCount: 5000,
    });

    expect(summary.count.actualCount).toBe(5000);
    expect(summary.count.method).toBe("aggregate_count");
    expect(summary.classification).toBe("VERIFIED");
  });

  it("does not confirm a join from field-name similarity alone when values mismatch", () => {
    const left = { collection: "patients", field: "patientName", values: ["Alice Smith", "Bob Jones"] };
    const right = { collection: "orders", field: "patientName", values: ["Charlie", "Dave"] };

    const result = verifyJoin(left, right);

    expect(result.exactMatches).toBe(0);
    expect(result.classification).toBe("UNKNOWN");
  });

  it("produces verified join counts with real matching keys", () => {
    const left = { collection: "rentals", field: "patientId", values: ["PAT-001", "PAT-002"] };
    const right = { collection: "patients", field: "patientId", values: ["PAT-001", "PAT-002"] };

    const result = verifyJoin(left, right);

    expect(result.exactMatches).toBe(2);
    expect(result.unmatchedLeft).toBe(0);
    expect(result.unmatchedRight).toBe(0);
    expect(result.classification).toBe("VERIFIED");
  });

  it("detects count contradictions across sections", () => {
    const claims = [
      { entity: "patients:total", value: 3, section: "sample" },
      { entity: "patients:total", value: 5, section: "aggregate" },
    ];

    const found = findCountContradictions(claims);
    expect(found).toHaveLength(1);
    expect(found[0].values).toEqual([3, 5]);
  });

  it("downgrades unsupported confirmed/proven/actual language", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "The data is confirmed and actual." });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Are we missing data?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("accuracy note");
  });

  it("allows hedged language without aggregate evidence", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "The sample suggests a likely gap." });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Are we missing data?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toBe("The sample suggests a likely gap.");
  });

  it("blocks unsafe remediation when evidence is inferred", () => {
    const decision = canRecommendAction("re_import", {
      summary: "rows missing",
      classification: "INFERRED",
      evidence: [{ kind: "import_metadata", reference: "job-1" }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("INFERRED");
  });

  it("allows remediation when defect is verified with evidence", () => {
    const decision = canRecommendAction("re_import", {
      summary: "written=0 while totalRows=962",
      classification: "VERIFIED",
      evidence: [
        { kind: "import_metadata", reference: "job-1 destinationSummary" },
        { kind: "aggregate_count", reference: "orders.count()=962" },
      ],
    });

    expect(decision.allowed).toBe(true);
  });

  it("generates CSV with contract-compliant columns", () => {
    const summaries = [
      summarizeSample("patients", Array.from({ length: 3 }, (_, i) => ({ id: `p${i}` })), 3, { aggregateCount: 5000 }),
    ];

    const csv = buildReportCsv(summaries);

    expect(csv).toContain("Collection");
    expect(csv).toContain("Sampled Rows");
    expect(csv).toContain("Actual Count");
    expect(csv).toContain("unknown");
    expect(buildReportCsv).toBeDefined();
  });

  it("preserves PHI Sentinel behavior unchanged", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Any PHI leaks?" },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const { scanTextForPhi, redactPhi } = await import("../phiSafety.js");
    expect(scanTextForPhi).toHaveBeenCalled();
    expect(redactPhi).toHaveBeenCalled();
  });

  it("does not enable web_search for internal operations insurance payer audit", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Internal operations insurance payer audit." },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const params = getLastOpenAiParams();
    const userPayload = getLastUserPayload();
    expect(userPayload.intent).toBe("internal-operations");
    expect(userPayload.webSearchInstructions).toBeNull();
    expect(params.tools).toBeUndefined();
    expect(params.tool_choice).toBeUndefined();
  });

  it("enables required web_search for explicit current insurance web request", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: {
        prompt: "Search the web for current Medicare coverage changes.",
      },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const params = getLastOpenAiParams() as {
      tools?: Array<{ type?: string }>;
      tool_choice?: string;
    };
    const userPayload = getLastUserPayload();
    expect(userPayload.intent).toBe("insurance-web-search");
    expect(userPayload.webSearchInstructions).toMatchObject({
      objective: expect.stringContaining("Search the live internet"),
    });
    expect(params.tools?.[0]).toMatchObject({ type: "web_search" });
    expect(params.tool_choice).toBe("required");
  });

  it("keeps internal patient rental linkage audit off public web", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: {
        prompt:
          "Internal audit: patients rentals linkage join verification and record integrity.",
      },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const params = getLastOpenAiParams();
    const userPayload = getLastUserPayload();
    expect(userPayload.intent).toBe("internal-operations");
    expect(userPayload.webSearchInstructions).toBeNull();
    expect(params.tools).toBeUndefined();
    expect(
      JSON.stringify(userPayload.context?.operationsOverview?.joins)
    ).toContain("value-join:rentals.patientId->patients.id");
  });

  it("includes an UNKNOWN marker for unsupported requested collections", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: {
        prompt: "Internal database audit collection billingRecords.",
      },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const userPayload = getLastUserPayload();
    expect(
      userPayload.context?.operationsOverview?.unavailableContext
    ).toContainEqual({
      collection: "billingRecords",
      reason: "unsupported_collection",
      classification: "UNKNOWN",
      evidenceRef: "unavailable-context:billingRecords:unsupported_collection",
    });
  });

  it("includes an UNKNOWN marker when a collection sample query fails", async () => {
    mockState.failingSampleCollections.add("insurancePatients");
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: {
        prompt: "Internal operations audit collection insurancePatients.",
      },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const userPayload = getLastUserPayload();
    expect(
      userPayload.context?.operationsOverview?.unavailableContext
    ).toContainEqual({
      collection: "insurancePatients",
      reason: "sample_query_failed",
      classification: "UNKNOWN",
      evidenceRef: "unavailable-context:insurancePatients:sample_query_failed",
    });
  });

  it("gates high-impact recommendation when defect is not VERIFIED", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "You should restore the patient records." });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "What should we do about missing data?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("Restoring is not recommended yet");
    expect(result.answer).not.toContain("You should restore the patient records.");
  });

  it("allows diagnostic investigate recommendation to pass through", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "Investigate payer linkage between insurance records and orders." });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Any data quality issues?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toBe("Investigate payer linkage between insurance records and orders.");
  });

  it("gates multiple recommendations independently", async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: "Re-import the patient records. Repair the duplicate records.",
    });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "What should we do?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("Re-importing is not recommended yet");
    expect(result.answer).toContain("Repairing data is not recommended yet");
  });

  it("records recommendation gate metrics in audit log", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "Backfill payer IDs for all insurance records." });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Any data quality issues?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("Repairing data is not recommended yet");

    const { buildAiAuditLogPayload } = await import("../services/aiLogger.js");
    expect(buildAiAuditLogPayload).toHaveBeenCalled();
  });

  it("does not send raw patientIds in model context", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Verify patient joins" },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const responseCalls = mockResponsesCreate.mock.calls as unknown as Array<
      [unknown]
    >;
    const serializedParams = JSON.stringify(responseCalls[0]?.[0]);
    expect(serializedParams).toContain("patientAuthorizations");
    expect(serializedParams).toContain("exactUniqueMatches");
    expect(serializedParams).not.toContain("PAT-JOIN-001");
    expect(serializedParams).not.toContain("PAT-JOIN-002");
    expect(serializedParams).not.toContain("PAT-JOIN-MISSING");
  });

  it("does not run value-join evidence for ordinary count questions", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "How many products are active?" },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const responseCalls = mockResponsesCreate.mock.calls as unknown as Array<
      [unknown]
    >;
    const serializedParams = JSON.stringify(responseCalls[0]?.[0]);
    expect(serializedParams).not.toContain("exactUniqueMatches");
    expect(serializedParams).not.toContain(
      "value-join:rentals.patientId->patients.id"
    );
  });

  it("does not write raw patientIds in CSV report artifacts", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Export a report and verify patient joins" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ reportArtifact: string | null }>)(request));

    expect(result.reportArtifact).toContain("Collection");
    expect(result.reportArtifact).not.toContain("PAT-JOIN-001");
    expect(result.reportArtifact).not.toContain("PAT-JOIN-002");
    expect(result.reportArtifact).not.toContain("PAT-JOIN-MISSING");
  });

  it("does not write raw patientIds in AI audit payload", async () => {
    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "Verify patient joins" },
    };

    await (askAdminAi as unknown as (req: unknown) => Promise<void>)(request);

    const { buildAiAuditLogPayload } = await import("../services/aiLogger.js");
    const serializedPayload = JSON.stringify(
      vi.mocked(buildAiAuditLogPayload).mock.calls.at(-1)?.[0]
    );

    expect(serializedPayload).toContain("joinEvidenceRefs");
    expect(serializedPayload).not.toContain("PAT-JOIN-001");
    expect(serializedPayload).not.toContain("PAT-JOIN-002");
    expect(serializedPayload).not.toContain("PAT-JOIN-MISSING");
  });

  it("passes source-evidence questions through internal diagnostics before Jarvis can claim VERIFIED source evidence", async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text:
        "VERIFIED: askAdminAi is in functions/src/ai/callable/askAdminAi.ts line 1.",
    });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "What file and line define askAdminAi source?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("VERIFIED");
    expect(mockRunDiagnosticRequest).toHaveBeenCalledWith({ tool: "repo_status" });
    expect(mockRunDiagnosticRequest).toHaveBeenCalledWith({
      tool: "repo_search",
      params: { query: "askAdminAi", limit: 5 },
    });

    const userPayload = getLastUserPayload();
    expect(userPayload.context?.diagnosticsOverview?.results?.[0]?.evidence.status).toBe("VERIFIED");
    expect(JSON.stringify(userPayload.context?.diagnosticsOverview)).toContain("LOCAL_WORKTREE");
  });

  it("marks source-evidence questions UNVERIFIED when the repository provider is unavailable", async () => {
    mockRunDiagnosticRequest.mockImplementation(async (request: {tool: string}) => ({
      tool: request.tool,
      evidence: {
        status: "UNVERIFIED",
        source: "repository_provider_unavailable",
        checkedAt: "now",
        reason: "Repository diagnostics provider is not configured.",
      },
      result: request.tool === "repo_status"
        ? {
            provider: {
              providerType: "UNAVAILABLE",
              repository: "Repository diagnostics provider is not configured.",
              snapshot: "unavailable",
              branch: null,
              commit: null,
              evidenceTimestamp: "now",
            },
            branch: "",
            head: "",
            clean: false,
            dirtyFiles: 0,
          }
        : {
            provider: {
              providerType: "UNAVAILABLE",
              repository: "Repository diagnostics provider is not configured.",
              snapshot: "unavailable",
              branch: null,
              commit: null,
              evidenceTimestamp: "now",
            },
            hits: [],
            resultCount: 0,
            truncated: false,
          },
      resultCount: 0,
    }));
    mockResponsesCreate.mockResolvedValue({
      output_text: "I found the source file.",
    });

    const request = {
      auth: {
        uid: "test-user",
        token: { role: "admin", email: "admin@test.com" },
      },
      data: { prompt: "What source file defines askAdminAi?" },
    };

    const result = (await (askAdminAi as unknown as (req: unknown) => Promise<{ answer: string }>)(request));

    expect(result.answer).toContain("UNVERIFIED");
    const userPayload = getLastUserPayload();
    expect(userPayload.context?.diagnosticsOverview?.results?.[0]?.evidence.status).toBe("UNVERIFIED");
    expect(JSON.stringify(userPayload.context?.diagnosticsOverview)).toContain("UNAVAILABLE");
  });
});
