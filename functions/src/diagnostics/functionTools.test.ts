import {describe, expect, it} from "vitest";

import {type CloudDiagnosticsClient, functionDescribe, functionLogs} from "./functionTools.js";
import {redactDiagnosticText} from "./redaction.js";

const client: CloudDiagnosticsClient = {
  async describeFunction() {
    return {
      state: "ACTIVE",
      updateTime: "2026-09-16T12:00:00Z",
      buildConfig: {
        runtime: "nodejs22",
        entryPoint: "askAdminAi",
      },
      serviceConfig: {
        uri: "https://askadminai.example.run.app",
        revision: "askadminai-00046-bax",
      },
    };
  },
  async describeCloudRunService() {
    return null;
  },
  async readFunctionLogs() {
    return [
      {
        timestamp: "2026-09-16T12:01:00Z",
        severity: "INFO",
        textPayload:
          "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456 email patient@example.com dob=01/02/1980 phone 555-111-2222",
      },
      {
        timestamp: "2026-09-16T12:00:00Z",
        severity: "ERROR",
        jsonPayload: {
          message: "failed with token sk_test_abcdefghijklmnopqrstuvwxyz123456",
          body: {raw: "request-body"},
          env: "OPENAI_API_KEY=secret",
        },
      },
    ];
  },
};

describe("cloud function diagnostics", () => {
  it("rejects unknown function names", async () => {
    await expect(functionDescribe("unknownFunction", client)).rejects.toThrow(/allowlisted/);
  });

  it("returns normalized function describe evidence", async () => {
    const result = await functionDescribe("askAdminAi", client);

    expect(result.evidence.status).toBe("VERIFIED");
    expect(result.result).toEqual({
      functionName: "askAdminAi",
      runtime: "nodejs22",
      region: "us-central1",
      state: "ACTIVE",
      entryPoint: "askAdminAi",
      updateTime: "2026-09-16T12:00:00Z",
      serviceUri: "https://askadminai.example.run.app",
      deployedRevision: "askadminai-00046-bax",
    });
  });

  it("uses Cloud Run latest ready revision when Functions metadata omits revision", async () => {
    const fallbackClient: CloudDiagnosticsClient = {
      async describeFunction() {
        return {
          state: "ACTIVE",
          updateTime: "2026-09-16T12:00:00Z",
          buildConfig: {
            runtime: "nodejs22",
            entryPoint: "askAdminAi",
          },
          serviceConfig: {
            uri: "https://askadminai.example.run.app",
          },
        };
      },
      async describeCloudRunService() {
        return {
          status: {
            latestReadyRevisionName: "askadminai-00046-bax",
          },
        };
      },
      async readFunctionLogs() {
        return [];
      },
    };

    const result = await functionDescribe("askAdminAi", fallbackClient);

    expect(result.result?.deployedRevision).toBe("askadminai-00046-bax");
  });

  it("rejects excessive log time ranges", async () => {
    await expect(functionLogs("askAdminAi", 61, 10, client)).rejects.toThrow(/exceeds/);
  });

  it("caps excessive log result counts and redacts sensitive log content", async () => {
    const result = await functionLogs("askAdminAi", 15, 999, client);

    expect(result.evidence.status).toBe("VERIFIED");
    expect(result.result?.entries).toHaveLength(2);
    const serialized = JSON.stringify(result.result?.entries);
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("Authorization: Bearer");
    expect(serialized).not.toContain("555-111-2222");
    expect(serialized).not.toContain("01/02/1980");
    expect(serialized).not.toContain("request-body");
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).toContain("[REDACTED_EMAIL]");
    expect(serialized).toContain("[REDACTED_SECRET]");
  });

  it("redacts tokens, authorization headers, emails, and PHI", () => {
    const redacted = redactDiagnosticText(
      "authorization=Bearer abcdefghijklmnopqrstuvwxyz123456 user jane@example.com dob=12/31/1970 ssn 123-45-6789",
    );

    expect(redacted).not.toContain("jane@example.com");
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });
});
