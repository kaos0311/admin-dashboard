import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

import {
  MAX_REPO_READ_LINES,
  MAX_REPO_SEARCH_QUERY_LENGTH,
  MAX_REPO_SEARCH_RESULTS,
  TRUSTED_REPO_ROOT,
} from "./config.js";
import {DiagnosticError} from "./types.js";

const execFileAsync = promisify(execFile);

export interface RepoSandboxOptions {
  repoRoot?: string;
}

export interface ValidatedRepoPath {
  relativePath: string;
  absolutePath: string;
}

const ALLOWED_PREFIXES = ["src/", "functions/src/"];
const BLOCKED_SEGMENTS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
]);

const BLOCKED_BASENAME_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /service[-_]?account/i,
  /firebase-adminsdk/i,
  /credential/i,
  /secret/i,
  /private[-_]?key/i,
  /(^|[-_.])key\.(json|pem|p12|pfx|crt|cer)$/i,
  /\.(pem|p12|pfx|key|crt|cer)$/i,
];

export function getTrustedRepoRoot(options: RepoSandboxOptions = {}): string {
  return path.resolve(options.repoRoot ?? TRUSTED_REPO_ROOT);
}

export async function assertTrustedRepoAvailable(options: RepoSandboxOptions = {}): Promise<string> {
  const repoRoot = getTrustedRepoRoot(options);
  try {
    const stat = await fs.stat(repoRoot);
    if (!stat.isDirectory()) {
      throw new DiagnosticError("failed-precondition", "Trusted repository root is not a directory.");
    }
  } catch (error) {
    if (error instanceof DiagnosticError) throw error;
    throw new DiagnosticError(
      "failed-precondition",
      "Trusted repository root is not available in this execution environment.",
    );
  }

  return repoRoot;
}

function toRepoRelativePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new DiagnosticError("invalid-argument", "Repository path is required.");
  }

  if (
    path.isAbsolute(trimmed) ||
    path.win32.isAbsolute(trimmed) ||
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith("\\\\")
  ) {
    throw new DiagnosticError("permission-denied", "Absolute paths are not allowed.");
  }

  const normalized = path.posix.normalize(trimmed.replace(/\\/g, "/"));
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new DiagnosticError("permission-denied", "Path traversal is not allowed.");
  }

  return normalized;
}

function assertAllowedSourcePath(relativePath: string): void {
  if (!ALLOWED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    throw new DiagnosticError("permission-denied", "Only src/** and functions/src/** are readable.");
  }

  const segments = relativePath.split("/");
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) {
      throw new DiagnosticError("permission-denied", "Blocked repository path segment.");
    }
  }

  const basename = segments.at(-1) ?? "";
  if (BLOCKED_BASENAME_PATTERNS.some((pattern) => pattern.test(basename))) {
    throw new DiagnosticError("permission-denied", "Sensitive file paths are not readable.");
  }
}

export async function getTrackedSourceFiles(options: RepoSandboxOptions = {}): Promise<Set<string>> {
  const repoRoot = await assertTrustedRepoAvailable(options);
  const {stdout} = await execFileAsync("git", ["ls-files", "--", "src", "functions/src"], {
    cwd: repoRoot,
    windowsHide: true,
    shell: false,
    maxBuffer: 1024 * 1024 * 4,
  });

  return new Set(
    stdout
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/\\/g, "/"))
      .filter(Boolean)
      .filter((item) => {
        try {
          assertAllowedSourcePath(item);
          return true;
        } catch {
          return false;
        }
      }),
  );
}

export async function validateTrackedRepoPath(
  inputPath: string,
  trackedFiles: ReadonlySet<string>,
  options: RepoSandboxOptions = {},
): Promise<ValidatedRepoPath> {
  const repoRoot = await assertTrustedRepoAvailable(options);
  const relativePath = toRepoRelativePath(inputPath);
  assertAllowedSourcePath(relativePath);

  if (!trackedFiles.has(relativePath)) {
    throw new DiagnosticError("permission-denied", "Only tracked source files are readable.");
  }

  const absolutePath = path.resolve(repoRoot, ...relativePath.split("/"));
  const [realRepoRoot, realFilePath] = await Promise.all([
    fs.realpath(repoRoot),
    fs.realpath(absolutePath),
  ]);
  const relativeToRoot = path.relative(realRepoRoot, realFilePath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    path.win32.isAbsolute(relativeToRoot)
  ) {
    throw new DiagnosticError("permission-denied", "Symlink escapes are not allowed.");
  }

  return {relativePath, absolutePath: realFilePath};
}

export async function validateRepoReadPath(inputPath: string, options: RepoSandboxOptions = {}): Promise<ValidatedRepoPath> {
  const repoRoot = await assertTrustedRepoAvailable(options);
  const trackedFiles = await getTrackedSourceFiles({repoRoot});
  return validateTrackedRepoPath(inputPath, trackedFiles, {repoRoot});
}

export function validateLineWindow(startLine: unknown, endLine: unknown): {startLine: number; endLine: number} {
  const start = Number(startLine);
  const end = Number(endLine);

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new DiagnosticError("invalid-argument", "Invalid line window.");
  }

  if (end - start + 1 > MAX_REPO_READ_LINES) {
    throw new DiagnosticError("invalid-argument", `Line window exceeds ${MAX_REPO_READ_LINES} lines.`);
  }

  return {startLine: start, endLine: end};
}

export function validateSearchQuery(query: unknown): string {
  if (typeof query !== "string" || !query.trim()) {
    throw new DiagnosticError("invalid-argument", "Search query is required.");
  }

  const cleanQuery = query.trim();
  if (cleanQuery.length > MAX_REPO_SEARCH_QUERY_LENGTH) {
    throw new DiagnosticError(
      "invalid-argument",
      `Search query exceeds ${MAX_REPO_SEARCH_QUERY_LENGTH} characters.`,
    );
  }

  return cleanQuery;
}

export function boundedSearchLimit(limit: unknown): number {
  const parsed = typeof limit === "number" ? Math.floor(limit) : MAX_REPO_SEARCH_RESULTS;
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_REPO_SEARCH_RESULTS;
  return Math.min(parsed, MAX_REPO_SEARCH_RESULTS);
}

export async function runFixedGit(args: readonly string[], options: RepoSandboxOptions = {}): Promise<string> {
  const repoRoot = await assertTrustedRepoAvailable(options);
  const {stdout} = await execFileAsync("git", [...args], {
    cwd: repoRoot,
    windowsHide: true,
    shell: false,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}
