#!/usr/bin/env node
"use strict";

const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const INCLUDE_HISTORY = process.argv.includes("--history");

const SKIP_DIR_PARTS = new Set([
  ".git",
  ".next",
  "node_modules",
  ".codex-backups",
  ".audit-tmp",
  "coverage",
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ps1",
  ".rules",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const PATTERNS = [
  {
    category: "private-key-block",
    severity: "FAIL",
    regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    category: "firebase-private-key",
    severity: "FAIL",
    regex: /"private_key"\s*:\s*"(?!\$\{|<|REDACTED|your_|example)[^"]{20,}"/i,
  },
  {
    category: "google-oauth-token",
    severity: "FAIL",
    regex: /ya29\.[0-9A-Za-z_-]{20,}/,
  },
  {
    category: "github-token",
    severity: "FAIL",
    regex: /gh[pousr]_[0-9A-Za-z_]{20,}/,
  },
  {
    category: "slack-token",
    severity: "FAIL",
    regex: /xox[baprs]-[0-9A-Za-z-]{20,}/,
  },
  {
    category: "openai-api-key",
    severity: "FAIL",
    regex: /sk-[A-Za-z0-9_-]{20,}/,
  },
  {
    category: "cloudflare-token",
    severity: "FAIL",
    regex: /(CLOUDFLARE_(?:API_)?TOKEN|TUNNEL_TOKEN)\s*=\s*(?!\$\{|<|REDACTED|your_|example)[^\s#]{20,}/i,
  },
  {
    category: "database-url",
    severity: "FAIL",
    regex: /DATABASE_URL\s*=\s*(?!\$\{|<|REDACTED|your_|example)(postgres(?:ql)?:\/\/|mysql:\/\/|mongodb(?:\+srv)?:\/\/)[^\s#]+/i,
  },
  {
    category: "generic-bearer-token",
    severity: "FAIL",
    regex: /Bearer\s+[A-Za-z0-9._~+/=-]{30,}/,
  },
  {
    category: "google-api-key",
    severity: "WARN",
    regex: /AIza[0-9A-Za-z_-]{20,}/,
  },
];

const CREDENTIAL_FILENAME = /(^|\/)(serviceAccountKey\.json|.*serviceAccount.*\.json|.*firebase-adminsdk.*\.json|.*\.pem|.*\.p12|.*\.pfx|.*\.key)$/i;

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

function normalize(file) {
  return file.replace(/\\/g, "/");
}

function shouldSkip(file) {
  const normalized = normalize(file);
  const parts = normalized.split("/");
  if (parts.includes("node_modules")) return true;
  if (parts.includes(".git")) return true;
  if (parts.includes(".next")) return true;
  if (parts.includes(".codex-backups")) return true;
  if (parts.includes(".audit-tmp")) return true;
  if (normalized.startsWith("functions/lib/")) return true;
  if (normalized.endsWith("package-lock.json")) return true;
  if (normalized.endsWith("skills-lock.json")) return true;
  if (parts.some((part) => SKIP_DIR_PARTS.has(part))) return true;

  const ext = path.extname(normalized);
  if (!ext && normalized !== ".env") return fs.existsSync(path.join(ROOT, file)) && fs.statSync(path.join(ROOT, file)).size > 1024 * 1024;
  return ext ? !TEXT_EXTENSIONS.has(ext) : false;
}

function scanText(text, file, source) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          source,
          severity: pattern.severity,
          category: pattern.category,
          file,
          line: index + 1,
        });
      }
    }
  }

  if (CREDENTIAL_FILENAME.test(normalize(file))) {
    findings.push({
      source,
      severity: "FAIL",
      category: "credential-like-filename",
      file,
      line: 0,
    });
  }

  return findings;
}

function scanCurrent() {
  const files = splitNul(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]));
  const findings = [];

  for (const file of files) {
    if (shouldSkip(file)) continue;
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;

    let text = "";
    try {
      text = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }

    findings.push(...scanText(text, normalize(file), "current"));
  }

  return findings;
}

function scanHistory() {
  const revs = git(["rev-list", "--all"]).trim().split(/\s+/).filter(Boolean);
  const findings = [];
  const needles = [
    "PRIVATE KEY",
    "private_key",
    "ya29.",
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_",
    "xoxb-",
    "xoxa-",
    "xoxp-",
    "xoxr-",
    "xoxs-",
    "sk-",
    "CLOUDFLARE_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "TUNNEL_TOKEN",
    "DATABASE_URL",
    "Bearer ",
    "AIza",
  ];
  const grepArgs = ["grep", "-I", "-n"];
  for (const needle of needles) {
    grepArgs.push("-e", needle);
  }

  for (let i = 0; i < revs.length; i += 50) {
    const chunk = revs.slice(i, i + 50);
    const result = spawnSync("git", [...grepArgs, ...chunk], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50,
    });

    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr || "git grep history scan failed");
    }

    for (const row of result.stdout.split(/\r?\n/).filter(Boolean)) {
      const match = row.match(/^([^:]+):([^:]+):(\d+):(.*)$/);
      if (!match) continue;
      const [, commit, file, lineNo, text] = match;
      const perLine = scanText(text, normalize(file), `history:${commit.slice(0, 12)}`);
      for (const finding of perLine) {
        finding.line = Number(lineNo);
        findings.push(finding);
      }
    }
  }

  return findings;
}

console.log("Secret Preflight");
console.log("================");

let findings = scanCurrent();

if (INCLUDE_HISTORY) {
  findings = findings.concat(scanHistory());
}

const unique = new Map();
for (const finding of findings) {
  const key = [
    finding.source,
    finding.severity,
    finding.category,
    finding.file,
    finding.line,
  ].join("|");
  unique.set(key, finding);
}
findings = Array.from(unique.values());

if (findings.length === 0) {
  console.log("[PASS] No obvious credential patterns found.");
  process.exit(0);
}

for (const finding of findings) {
  const line = finding.line > 0 ? `:${finding.line}` : "";
  console.log(
    `[${finding.severity}] ${finding.category} ${finding.source} ${finding.file}${line}`
  );
}

const failures = findings.filter((finding) => finding.severity === "FAIL");
if (failures.length > 0) {
  console.error(`\n[FAIL] ${failures.length} credential finding(s). Values were redacted.`);
  process.exit(1);
}

console.warn(`\n[WARN] ${findings.length} secret-scan warning(s). Values were redacted.`);
process.exit(0);
