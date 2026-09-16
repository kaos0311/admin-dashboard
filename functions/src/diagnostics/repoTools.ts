import fs from "node:fs/promises";

import {diagnosticEvidence} from "./evidence.js";
import {redactDiagnosticText} from "./redaction.js";
import {
  boundedSearchLimit,
  getTrackedSourceFiles,
  RepoSandboxOptions,
  runFixedGit,
  validateLineWindow,
  validateRepoReadPath,
  validateSearchQuery,
  validateTrackedRepoPath,
} from "./repoSandbox.js";
import type {
  DiagnosticEnvelope,
  RepoReadInput,
  RepoReadResult,
  RepoSearchInput,
  RepoSearchResult,
  RepositoryDiagnosticsProvider,
  RepositoryProviderIdentity,
  RepoStatusResult,
} from "./types.js";

function previewLine(line: string): string {
  return redactDiagnosticText(line).replace(/\s+/g, " ").trim().slice(0, 240);
}

function localIdentity(params: {
  repoRoot: string;
  branch: string | null;
  commit: string | null;
}): RepositoryProviderIdentity {
  return {
    providerType: "LOCAL_WORKTREE",
    repository: params.repoRoot,
    snapshot: params.commit ? `local-worktree:${params.commit}` : "local-worktree:unknown",
    branch: params.branch,
    commit: params.commit,
    evidenceTimestamp: new Date().toISOString(),
  };
}

export class LocalWorktreeRepositoryDiagnosticsProvider implements RepositoryDiagnosticsProvider {
  readonly identity: RepositoryProviderIdentity;

  constructor(private readonly options: RepoSandboxOptions = {}) {
    this.identity = localIdentity({
      repoRoot: this.options.repoRoot ?? "D:\\projects\\admin-dashboard",
      branch: null,
      commit: null,
    });
  }

  private async currentIdentity(): Promise<RepositoryProviderIdentity> {
    const [branch, head] = await Promise.all([
      runFixedGit(["branch", "--show-current"], this.options),
      runFixedGit(["rev-parse", "HEAD"], this.options),
    ]);
    return localIdentity({
      repoRoot: this.options.repoRoot ?? "D:\\projects\\admin-dashboard",
      branch: branch.trim() || null,
      commit: head.trim() || null,
    });
  }

  async status(): Promise<DiagnosticEnvelope<RepoStatusResult>> {
    const [identity, status] = await Promise.all([
      this.currentIdentity(),
      runFixedGit(["status", "--porcelain=v1"], this.options),
    ]);
    const dirtyFiles = status.split(/\r?\n/).filter(Boolean).length;

    return {
      tool: "repo_status",
      evidence: diagnosticEvidence("VERIFIED", "local_worktree_git_status"),
      result: {
        provider: identity,
        branch: identity.branch ?? "",
        head: identity.commit ?? "",
        clean: dirtyFiles === 0,
        dirtyFiles,
      },
      resultCount: 1,
    };
  }

  async read(input: RepoReadInput): Promise<DiagnosticEnvelope<RepoReadResult>> {
    const identity = await this.currentIdentity();
    const window = validateLineWindow(input.startLine, input.endLine);
    const validated = await validateRepoReadPath(input.path, this.options);
    const content = await fs.readFile(validated.absolutePath, "utf8");
    const allLines = content.split(/\r?\n/);
    const lines = allLines
      .slice(window.startLine - 1, window.endLine)
      .map((text, index) => ({
        line: window.startLine + index,
        text: redactDiagnosticText(text),
      }));

    return {
      tool: "repo_read",
      evidence: diagnosticEvidence("VERIFIED", "local_worktree_tracked_source"),
      result: {
        provider: identity,
        path: validated.relativePath,
        startLine: window.startLine,
        endLine: window.endLine,
        lines,
      },
      resultCount: lines.length,
    };
  }

  async search(input: RepoSearchInput): Promise<DiagnosticEnvelope<RepoSearchResult>> {
    const identity = await this.currentIdentity();
    const cleanQuery = validateSearchQuery(input.query);
    const maxResults = boundedSearchLimit(input.limit);
    const trackedFiles = await getTrackedSourceFiles(this.options);
    const files = Array.from(trackedFiles).sort();
    const needle = cleanQuery.toLocaleLowerCase();
    const hits: RepoSearchResult["hits"] = [];
    let truncated = false;

    for (const relativePath of files) {
      const validated = await validateTrackedRepoPath(relativePath, trackedFiles, this.options);
      const content = await fs.readFile(validated.absolutePath, "utf8");
      const lines = content.split(/\r?\n/);

      for (const [index, line] of lines.entries()) {
        if (!line.toLocaleLowerCase().includes(needle)) continue;

        if (hits.length >= maxResults) {
          truncated = true;
          break;
        }

        hits.push({
          path: relativePath,
          line: index + 1,
          preview: previewLine(line),
        });
      }

      if (truncated) break;
    }

    return {
      tool: "repo_search",
      evidence: diagnosticEvidence("VERIFIED", "local_worktree_literal_search"),
      result: {
        provider: identity,
        hits,
        resultCount: hits.length,
        truncated,
      },
      resultCount: hits.length,
    };
  }
}

export async function repoStatus(options: RepoSandboxOptions = {}): Promise<DiagnosticEnvelope<RepoStatusResult>> {
  return new LocalWorktreeRepositoryDiagnosticsProvider(options).status();
}

export async function repoRead(
  path: string,
  startLine: unknown,
  endLine: unknown,
  options: RepoSandboxOptions = {},
): Promise<DiagnosticEnvelope<RepoReadResult>> {
  return new LocalWorktreeRepositoryDiagnosticsProvider(options).read({
    path,
    startLine: Number(startLine),
    endLine: Number(endLine),
  });
}

export async function repoSearch(
  query: unknown,
  limit: unknown,
  options: RepoSandboxOptions = {},
): Promise<DiagnosticEnvelope<RepoSearchResult>> {
  return new LocalWorktreeRepositoryDiagnosticsProvider(options).search({
    query: typeof query === "string" ? query : "",
    limit: typeof limit === "number" ? limit : undefined,
  });
}
