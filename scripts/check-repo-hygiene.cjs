#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOTS = ["src", "functions/src", "scripts"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORED_SOURCE_ALLOWLIST = ["src/generated/"];
const IGNORED_NON_SOURCE_ALLOWLIST = new Set(["scripts/serviceAccountKey.json"]);

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function splitNul(value) {
  return value.split("\0").filter(Boolean);
}

function normalize(value) {
  return value.replace(/\\/g, "/");
}

function unique(values) {
  return [...new Set(values.map(normalize))].sort();
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function sizeOf(file) {
  try {
    return fs.statSync(path.join(ROOT, file)).size;
  } catch {
    return 0;
  }
}

function isTrackedArtifact(file) {
  const f = normalize(file);
  const base = path.posix.basename(f);

  return (
    f.includes(".codex-backups/") ||
    f.includes(".audit-tmp/") ||
    f.includes(".bak-") ||
    f.endsWith(".bak-product-image") ||
    f.endsWith(".log") ||
    f.endsWith("-scan.txt") ||
    f.endsWith("_output.txt") ||
    f.endsWith("_trace.txt") ||
    f === "nul" ||
    f.endsWith("/nul") ||
    f === "repo-snapshot.txt" ||
    f.startsWith("repo-snapshot-") ||
    f === "prisma-usage.txt" ||
    f === "create-user-after-deploy.json" ||
    f.startsWith("tmp-") ||
    f.startsWith("tsc_") ||
    f.startsWith("theme-scan") ||
    f.startsWith("theme-audit-snapshot") ||
    base === "firebase-debug.log" ||
    base === "firestore-debug.log"
  );
}

function isInSourceRoot(file) {
  const f = normalize(file);
  return SOURCE_ROOTS.some((root) => f === root || f.startsWith(`${root}/`));
}

function isSourceExtension(file) {
  return SOURCE_EXTENSIONS.has(path.posix.extname(normalize(file)).toLowerCase());
}

function isIgnoredSourceAllowed(file) {
  const f = normalize(file);
  if (IGNORED_NON_SOURCE_ALLOWLIST.has(f)) return true;
  return IGNORED_SOURCE_ALLOWLIST.some((prefix) => f.startsWith(prefix));
}

function isSourceTreeBackupArtifact(file) {
  const f = normalize(file);
  const base = path.posix.basename(f);
  return (
    isInSourceRoot(f) &&
    (base.endsWith(".bak") ||
      base.endsWith(".backup") ||
      base.endsWith(".old") ||
      base.includes(".cleanup-") ||
      isTrackedArtifact(f))
  );
}

function isMalformedRootName(file) {
  const f = normalize(file);
  if (f.includes("/")) return false;

  return (
    f === "{" ||
    f === "0" ||
    f.startsWith("'") ||
    f.includes("console.error(") ||
    /[<>|]/.test(f)
  );
}

function classify(file, tracked) {
  const reasons = [];
  if (isTrackedArtifact(file)) reasons.push("generated-or-backup-artifact");
  if (isMalformedRootName(file)) reasons.push("malformed-root-filename");
  if (file === ".env" || file.startsWith(".env.")) {
    reasons.push(tracked ? "tracked-env-file" : "local-env-file");
  }
  if (/serviceaccount|firebase-adminsdk/i.test(file)) {
    reasons.push("credential-like-filename");
  }
  return reasons;
}

const tracked = splitNul(git(["ls-files", "-z"]));
const trackedSourceRootFiles = splitNul(git(["ls-files", "-z", "--", ...SOURCE_ROOTS]));
const ignoredSourceRootFiles = splitNul(
  git(["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", ...SOURCE_ROOTS])
);
const untrackedSourceRootFiles = splitNul(
  git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...SOURCE_ROOTS])
);
const status = git(["status", "--porcelain=v1", "-z"]);
const statusEntries = splitNul(status);
const untracked = [];

for (const entry of statusEntries) {
  if (entry.startsWith("?? ")) {
    untracked.push(entry.slice(3));
  }
}

const findings = [];
const ignoredSourceFindings = [];
const sourceTreeBackupFindings = [];

for (const file of tracked) {
  for (const reason of classify(file, true)) {
    findings.push({
      severity: reason === "local-env-file" ? "WARN" : "FAIL",
      state: "TRACKED",
      reason,
      file,
      size: exists(file) ? sizeOf(file) : null,
    });
  }
}

for (const file of untracked) {
  for (const reason of classify(file, false)) {
    findings.push({
      severity:
        reason === "malformed-root-filename" ||
        reason === "credential-like-filename"
          ? "FAIL"
          : "WARN",
      state: "UNTRACKED",
      reason,
      file,
      size: exists(file) ? sizeOf(file) : null,
    });
  }
}

for (const file of unique(ignoredSourceRootFiles)) {
  if (
    isInSourceRoot(file) &&
    isSourceExtension(file) &&
    !isIgnoredSourceAllowed(file)
  ) {
    ignoredSourceFindings.push({
      severity: "FAIL",
      state: "IGNORED",
      reason: "unexpected-ignored-source-file",
      file,
      size: exists(file) ? sizeOf(file) : null,
    });
  }
}

for (const file of unique([
  ...trackedSourceRootFiles,
  ...untrackedSourceRootFiles,
  ...ignoredSourceRootFiles,
])) {
  if (isSourceTreeBackupArtifact(file)) {
    sourceTreeBackupFindings.push({
      severity: "FAIL",
      state: "SOURCE-TREE",
      reason: "backup-or-scratch-artifact",
      file,
      size: exists(file) ? sizeOf(file) : null,
    });
  }
}

console.log("Repository Hygiene Preflight");
console.log("============================");

const legacyFailures = findings.filter((finding) => finding.severity === "FAIL");

if (legacyFailures.length === 0) {
  console.log("[PASS] No tracked release-blocking artifacts found.");
}

for (const finding of findings) {
  const size = finding.size === null ? "missing" : `${finding.size} bytes`;
  console.log(
    `[${finding.severity}] ${finding.state} ${finding.reason}: ${finding.file} (${size})`
  );
}

if (ignoredSourceFindings.length === 0) {
  console.log("[PASS] No unexpected ignored source files found.");
} else {
  for (const finding of ignoredSourceFindings) {
    const size = finding.size === null ? "missing" : `${finding.size} bytes`;
    console.log(
      `[${finding.severity}] ${finding.state} ${finding.reason}: ${finding.file} (${size})`
    );
  }
}

if (sourceTreeBackupFindings.length === 0) {
  console.log("[PASS] No source-tree backup artifacts found.");
} else {
  for (const finding of sourceTreeBackupFindings) {
    const size = finding.size === null ? "missing" : `${finding.size} bytes`;
    console.log(
      `[${finding.severity}] ${finding.state} ${finding.reason}: ${finding.file} (${size})`
    );
  }
}

const failures = [
  ...legacyFailures,
  ...ignoredSourceFindings,
  ...sourceTreeBackupFindings,
];
if (failures.length > 0) {
  console.error(`\n[FAIL] ${failures.length} release-blocking hygiene finding(s).`);
  process.exit(1);
}

const warnings = findings.filter((finding) => finding.severity === "WARN");
if (warnings.length > 0) {
  console.warn(`\n[WARN] ${warnings.length} hygiene warning(s).`);
}

process.exit(0);
