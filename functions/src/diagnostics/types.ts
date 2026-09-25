export type DiagnosticTool =
  | "repo_status"
  | "repo_search"
  | "repo_read"
  | "function_describe"
  | "function_logs";

export type DiagnosticEvidenceStatus = "VERIFIED" | "UNVERIFIED" | "REJECTED";

export interface DiagnosticEvidence {
  status: DiagnosticEvidenceStatus;
  source: string;
  checkedAt: string;
  reason?: string;
}

export type RepositoryProviderType =
  | "LOCAL_WORKTREE"
  | "GITHUB_COMMITTED_SOURCE"
  | "UNAVAILABLE";

export interface RepositoryProviderIdentity {
  providerType: RepositoryProviderType;
  repository: string;
  snapshot: string;
  branch: string | null;
  commit: string | null;
  evidenceTimestamp: string;
}

export interface DiagnosticEnvelope<T> {
  tool: DiagnosticTool;
  evidence: DiagnosticEvidence;
  result: T | null;
  resultCount: number;
}

export interface RepoStatusResult {
  provider: RepositoryProviderIdentity;
  branch: string;
  head: string;
  clean: boolean;
  dirtyFiles: number;
}

export interface RepoSearchInput {
  query: string;
  limit?: number;
}

export interface RepoSearchHit {
  path: string;
  line: number;
  preview: string;
}

export interface RepoSearchResult {
  provider: RepositoryProviderIdentity;
  hits: RepoSearchHit[];
  resultCount: number;
  truncated: boolean;
}

export interface RepoReadInput {
  path: string;
  startLine: number;
  endLine: number;
}

export interface RepoReadResult {
  provider: RepositoryProviderIdentity;
  path: string;
  startLine: number;
  endLine: number;
  lines: Array<{line: number; text: string}>;
}

export interface FunctionDescribeInput {
  functionName: string;
}

export interface FunctionDescribeResult {
  functionName: string;
  runtime: string | null;
  region: string;
  state: string | null;
  entryPoint: string | null;
  updateTime: string | null;
  serviceUri: string | null;
  deployedRevision: string | null;
}

export interface FunctionLogsInput {
  functionName: string;
  minutes: number;
  limit?: number;
}

export interface FunctionLogEntry {
  timestamp: string;
  severity: string;
  message: string;
}

export interface FunctionLogsResult {
  functionName: string;
  minutes: number;
  entries: FunctionLogEntry[];
  resultCount: number;
  truncated: boolean;
}

export type DiagnosticRequest =
  | {tool: "repo_status"; params?: Record<string, never>}
  | {tool: "repo_search"; params: RepoSearchInput}
  | {tool: "repo_read"; params: RepoReadInput}
  | {tool: "function_describe"; params: FunctionDescribeInput}
  | {tool: "function_logs"; params: FunctionLogsInput};

export type DiagnosticResult =
  | DiagnosticEnvelope<RepoStatusResult>
  | DiagnosticEnvelope<RepoSearchResult>
  | DiagnosticEnvelope<RepoReadResult>
  | DiagnosticEnvelope<FunctionDescribeResult>
  | DiagnosticEnvelope<FunctionLogsResult>;

export interface RepositoryDiagnosticsProvider {
  readonly identity: RepositoryProviderIdentity;
  status(): Promise<DiagnosticEnvelope<RepoStatusResult>>;
  search(input: RepoSearchInput): Promise<DiagnosticEnvelope<RepoSearchResult>>;
  read(input: RepoReadInput): Promise<DiagnosticEnvelope<RepoReadResult>>;
}

export class DiagnosticError extends Error {
  constructor(
    public readonly code: "invalid-argument" | "permission-denied" | "failed-precondition" | "not-found",
    message: string,
  ) {
    super(message);
    this.name = "DiagnosticError";
  }
}
