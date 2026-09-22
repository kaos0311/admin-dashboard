import {
  GITHUB_BRANCH_ENV,
  GITHUB_OWNER_ENV,
  GITHUB_REPO_ENV,
  GITHUB_TOKEN_ENV,
  MAX_REPO_SEARCH_RESULTS,
  REPO_PROVIDER_ENV,
  TRUSTED_REPO_ROOT,
} from "./config.js";
import {diagnosticEvidence} from "./evidence.js";
import {redactDiagnosticText} from "./redaction.js";
import {
  LocalWorktreeRepositoryDiagnosticsProvider,
  PRODUCTION_REPOSITORY_DIAGNOSTICS_GUIDANCE,
} from "./repoTools.js";
import {
  boundedSearchLimit,
  validateLineWindow,
  validateSearchQuery,
} from "./repoSandbox.js";
import {functionDescribe, functionLogs} from "./functionTools.js";
import type {
  DiagnosticRequest,
  DiagnosticResult,
  RepoReadInput,
  RepoSearchInput,
  RepoSearchResult,
  RepositoryDiagnosticsProvider,
  RepositoryProviderIdentity,
} from "./types.js";

function unavailableIdentity(reason = "Repository provider is not configured."): RepositoryProviderIdentity {
  return {
    providerType: "UNAVAILABLE",
    repository: reason,
    snapshot: "unavailable",
    branch: null,
    commit: null,
    evidenceTimestamp: new Date().toISOString(),
  };
}

class UnavailableRepositoryDiagnosticsProvider implements RepositoryDiagnosticsProvider {
  readonly identity = unavailableIdentity();

  constructor(private readonly reason = "Production repository diagnostics provider is not configured.") {}

  async status() {
    return {
      tool: "repo_status" as const,
      evidence: diagnosticEvidence("UNVERIFIED", "repository_provider_unavailable", this.reason),
      result: {
        provider: unavailableIdentity(this.reason),
        branch: "",
        head: "",
        clean: false,
        dirtyFiles: 0,
      },
      resultCount: 0,
    };
  }

  async search(input: RepoSearchInput) {
    validateSearchQuery(input.query);
    return {
      tool: "repo_search" as const,
      evidence: diagnosticEvidence("UNVERIFIED", "repository_provider_unavailable", this.reason),
      result: {
        provider: unavailableIdentity(this.reason),
        hits: [],
        resultCount: 0,
        truncated: false,
      },
      resultCount: 0,
    };
  }

  async read(input: RepoReadInput) {
    validateLineWindow(input.startLine, input.endLine);
    return {
      tool: "repo_read" as const,
      evidence: diagnosticEvidence("UNVERIFIED", "repository_provider_unavailable", this.reason),
      result: {
        provider: unavailableIdentity(this.reason),
        path: input.path,
        startLine: input.startLine,
        endLine: input.endLine,
        lines: [],
      },
      resultCount: 0,
    };
  }
}

interface GitHubTreeEntry {
  path?: string;
  type?: string;
}

interface GitHubBlobResponse {
  content?: string;
  encoding?: string;
}

class GitHubRepositoryDiagnosticsProvider implements RepositoryDiagnosticsProvider {
  readonly identity: RepositoryProviderIdentity;

  constructor(
    private readonly options: {
      owner: string;
      repo: string;
      branch: string;
      token: string;
    },
  ) {
    this.identity = {
      providerType: "GITHUB_COMMITTED_SOURCE",
      repository: `${options.owner}/${options.repo}`,
      snapshot: `github:${options.branch}`,
      branch: options.branch,
      commit: null,
      evidenceTimestamp: new Date().toISOString(),
    };
  }

  private async githubFetch<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${this.options.owner}/${this.options.repo}${path}`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${this.options.token}`,
        "User-Agent": "ahm-jarvis-diagnostics",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub diagnostics request failed with status ${response.status}.`);
    }

    return await response.json() as T;
  }

  private async currentIdentity(): Promise<RepositoryProviderIdentity> {
    const ref = await this.githubFetch<{object?: {sha?: string}}>(
      `/git/ref/heads/${encodeURIComponent(this.options.branch)}`,
    );
    const commit = ref.object?.sha ?? null;
    return {
      providerType: "GITHUB_COMMITTED_SOURCE",
      repository: `${this.options.owner}/${this.options.repo}`,
      snapshot: commit ? `github:${commit}` : `github:${this.options.branch}`,
      branch: this.options.branch,
      commit,
      evidenceTimestamp: new Date().toISOString(),
    };
  }

  private async listSourceFiles(commit: string): Promise<string[]> {
    const tree = await this.githubFetch<{tree?: GitHubTreeEntry[]}>(
      `/git/trees/${encodeURIComponent(commit)}?recursive=1`,
    );
    return (tree.tree ?? [])
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
      .map((entry) => entry.path ?? "")
      .filter((path) => path.startsWith("src/") || path.startsWith("functions/src/"));
  }

  private async readFile(path: string, commit: string): Promise<string> {
    const blob = await this.githubFetch<GitHubBlobResponse>(
      `/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(commit)}`,
    );
    if (blob.encoding !== "base64" || !blob.content) return "";
    return Buffer.from(blob.content, "base64").toString("utf8");
  }

  async status() {
    const identity = await this.currentIdentity();
    return {
      tool: "repo_status" as const,
      evidence: diagnosticEvidence("VERIFIED", "github_committed_source"),
      result: {
        provider: identity,
        branch: identity.branch ?? "",
        head: identity.commit ?? "",
        clean: true,
        dirtyFiles: 0,
      },
      resultCount: 1,
    };
  }

  async search(input: RepoSearchInput) {
    const query = validateSearchQuery(input.query);
    const limit = boundedSearchLimit(input.limit);
    const identity = await this.currentIdentity();
    const commit = identity.commit;
    if (!commit) {
      return new UnavailableRepositoryDiagnosticsProvider("GitHub branch did not resolve to a commit.").search(input);
    }
    const hits: RepoSearchResult["hits"] = [];
    const needle = query.toLocaleLowerCase();
    let truncated = false;

    for (const path of await this.listSourceFiles(commit)) {
      const content = await this.readFile(path, commit);
      for (const [index, line] of content.split(/\r?\n/).entries()) {
        if (!line.toLocaleLowerCase().includes(needle)) continue;
        if (hits.length >= limit) {
          truncated = true;
          break;
        }
        hits.push({
          path,
          line: index + 1,
          preview: redactDiagnosticText(line).replace(/\s+/g, " ").trim().slice(0, 240),
        });
      }
      if (truncated || hits.length >= MAX_REPO_SEARCH_RESULTS) break;
    }

    return {
      tool: "repo_search" as const,
      evidence: diagnosticEvidence("VERIFIED", "github_committed_source_literal_search"),
      result: {
        provider: identity,
        hits,
        resultCount: hits.length,
        truncated,
      },
      resultCount: hits.length,
    };
  }

  async read(input: RepoReadInput) {
    const window = validateLineWindow(input.startLine, input.endLine);
    const identity = await this.currentIdentity();
    const commit = identity.commit;
    if (!commit) {
      return new UnavailableRepositoryDiagnosticsProvider("GitHub branch did not resolve to a commit.").read(input);
    }
    const allowedFiles = await this.listSourceFiles(commit);
    if (!allowedFiles.includes(input.path)) {
      return new UnavailableRepositoryDiagnosticsProvider("Requested file is not an allowed committed source file.").read(input);
    }
    const content = await this.readFile(input.path, commit);
    const lines = content.split(/\r?\n/)
      .slice(window.startLine - 1, window.endLine)
      .map((text, index) => ({
        line: window.startLine + index,
        text: redactDiagnosticText(text),
      }));

    return {
      tool: "repo_read" as const,
      evidence: diagnosticEvidence("VERIFIED", "github_committed_source_file"),
      result: {
        provider: identity,
        path: input.path,
        startLine: window.startLine,
        endLine: window.endLine,
        lines,
      },
      resultCount: lines.length,
    };
  }
}

export function createRepositoryDiagnosticsProvider(): RepositoryDiagnosticsProvider {
  const provider = process.env[REPO_PROVIDER_ENV];

  if (provider === "LOCAL_WORKTREE") {
    return new LocalWorktreeRepositoryDiagnosticsProvider({repoRoot: TRUSTED_REPO_ROOT});
  }

  if (provider === "GITHUB") {
    const owner = process.env[GITHUB_OWNER_ENV];
    const repo = process.env[GITHUB_REPO_ENV];
    const branch = process.env[GITHUB_BRANCH_ENV] ?? "ai-development";
    const token = process.env[GITHUB_TOKEN_ENV];

    if (owner && repo && token) {
      return new GitHubRepositoryDiagnosticsProvider({owner, repo, branch, token});
    }

    return new UnavailableRepositoryDiagnosticsProvider("GitHub repository diagnostics provider is missing owner, repo, or token configuration.");
  }

  return new UnavailableRepositoryDiagnosticsProvider(
    PRODUCTION_REPOSITORY_DIAGNOSTICS_GUIDANCE,
  );
}

export async function runDiagnosticRequest(
  request: DiagnosticRequest,
  options: {
    repositoryProvider?: RepositoryDiagnosticsProvider;
  } = {},
): Promise<DiagnosticResult> {
  const repositoryProvider = options.repositoryProvider ?? createRepositoryDiagnosticsProvider();

  switch (request.tool) {
  case "repo_status":
    return repositoryProvider.status();
  case "repo_search":
    return repositoryProvider.search(request.params);
  case "repo_read":
    return repositoryProvider.read(request.params);
  case "function_describe":
    return functionDescribe(request.params.functionName);
  case "function_logs":
    return functionLogs(request.params.functionName, request.params.minutes, request.params.limit);
  }
}
