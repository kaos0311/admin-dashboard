import {afterEach, describe, expect, it} from "vitest";

import {PRODUCTION_REPOSITORY_DIAGNOSTICS_GUIDANCE} from "./repoTools.js";
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
    expect(result.evidence.reason).toBe(PRODUCTION_REPOSITORY_DIAGNOSTICS_GUIDANCE);
    const repoStatus = result.result as {provider?: {providerType?: string}} | null;
    expect(repoStatus?.provider?.providerType).toBe("UNAVAILABLE");
    expect(repoStatus?.provider).toMatchObject({
      repository: PRODUCTION_REPOSITORY_DIAGNOSTICS_GUIDANCE,
    });
  });

  it("creates an unavailable provider instead of pretending local repo access exists by default", () => {
    delete process.env.DIAGNOSTICS_REPO_PROVIDER;

    const provider = createRepositoryDiagnosticsProvider();

    expect(provider.identity.providerType).toBe("UNAVAILABLE");
  });
});
