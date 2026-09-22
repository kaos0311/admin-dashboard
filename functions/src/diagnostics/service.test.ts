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

  it("selects the GitHub committed-source provider when production config is complete", () => {
    const original = {
      provider: process.env.DIAGNOSTICS_REPO_PROVIDER,
      owner: process.env.DIAGNOSTICS_GITHUB_OWNER,
      repo: process.env.DIAGNOSTICS_GITHUB_REPO,
      branch: process.env.DIAGNOSTICS_GITHUB_BRANCH,
      token: process.env.DIAGNOSTICS_GITHUB_TOKEN,
    };

    try {
      process.env.DIAGNOSTICS_REPO_PROVIDER = "GITHUB";
      process.env.DIAGNOSTICS_GITHUB_OWNER = "kaos0311";
      process.env.DIAGNOSTICS_GITHUB_REPO = "admin-dashboard";
      process.env.DIAGNOSTICS_GITHUB_BRANCH = "ai-development";
      process.env.DIAGNOSTICS_GITHUB_TOKEN = "test-token";

      const provider = createRepositoryDiagnosticsProvider();

      expect(provider.identity).toMatchObject({
        providerType: "GITHUB_COMMITTED_SOURCE",
        repository: "kaos0311/admin-dashboard",
        branch: "ai-development",
        commit: null,
      });
    } finally {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      };

      restore("DIAGNOSTICS_REPO_PROVIDER", original.provider);
      restore("DIAGNOSTICS_GITHUB_OWNER", original.owner);
      restore("DIAGNOSTICS_GITHUB_REPO", original.repo);
      restore("DIAGNOSTICS_GITHUB_BRANCH", original.branch);
      restore("DIAGNOSTICS_GITHUB_TOKEN", original.token);
    }
  });

  it("keeps GitHub diagnostics unavailable when the token is missing", async () => {
    const original = {
      provider: process.env.DIAGNOSTICS_REPO_PROVIDER,
      owner: process.env.DIAGNOSTICS_GITHUB_OWNER,
      repo: process.env.DIAGNOSTICS_GITHUB_REPO,
      branch: process.env.DIAGNOSTICS_GITHUB_BRANCH,
      token: process.env.DIAGNOSTICS_GITHUB_TOKEN,
    };

    try {
      process.env.DIAGNOSTICS_REPO_PROVIDER = "GITHUB";
      process.env.DIAGNOSTICS_GITHUB_OWNER = "kaos0311";
      process.env.DIAGNOSTICS_GITHUB_REPO = "admin-dashboard";
      process.env.DIAGNOSTICS_GITHUB_BRANCH = "ai-development";
      delete process.env.DIAGNOSTICS_GITHUB_TOKEN;

      const result = await runDiagnosticRequest({tool: "repo_status"});

      expect(result.evidence.status).toBe("UNVERIFIED");
      const repoStatus = result.result as {provider?: {providerType?: string}} | null;
      expect(repoStatus?.provider?.providerType).toBe("UNAVAILABLE");
    } finally {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      };

      restore("DIAGNOSTICS_REPO_PROVIDER", original.provider);
      restore("DIAGNOSTICS_GITHUB_OWNER", original.owner);
      restore("DIAGNOSTICS_GITHUB_REPO", original.repo);
      restore("DIAGNOSTICS_GITHUB_BRANCH", original.branch);
      restore("DIAGNOSTICS_GITHUB_TOKEN", original.token);
    }
  });
});
