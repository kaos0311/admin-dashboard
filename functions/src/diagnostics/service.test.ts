import {afterEach, describe, expect, it} from "vitest";

import {createRepositoryDiagnosticsProvider, runDiagnosticRequest} from "./service.js";

describe("diagnostics service provider selection", () => {
  const originalProvider = process.env.DIAGNOSTICS_REPO_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.DIAGNOSTICS_REPO_PROVIDER;
    } else {
      process.env.DIAGNOSTICS_REPO_PROVIDER = originalProvider;
    }
  });

  it("marks production repo diagnostics UNVERIFIED when no provider is configured", async () => {
    delete process.env.DIAGNOSTICS_REPO_PROVIDER;

    const result = await runDiagnosticRequest({
      tool: "repo_status",
    });

    expect(result.evidence.status).toBe("UNVERIFIED");
    const repoStatus = result.result as {provider?: {providerType?: string}} | null;
    expect(repoStatus?.provider?.providerType).toBe("UNAVAILABLE");
  });

  it("creates an unavailable provider instead of pretending local repo access exists by default", () => {
    delete process.env.DIAGNOSTICS_REPO_PROVIDER;

    const provider = createRepositoryDiagnosticsProvider();

    expect(provider.identity.providerType).toBe("UNAVAILABLE");
  });
});
