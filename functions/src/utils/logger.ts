/**
 * Server logger — zero-dependency, redaction-aware.
 *
 * Design per OBSERVABILITY_AUDIT.md §10. Wraps Cloud Functions console.*
 * output with a redaction walker. In production this can be swapped for
 * Cloud Logging structured events without changing call sites.
 */

import type { AppErrorSeverity } from "../errors/appError";

const REDACTED_KEYS = new Set([
  "password",
  "newPassword",
  "confirmPassword",
  "token",
  "idToken",
  "refreshToken",
  "authorization",
  "cookie",
  "apiKey",
  "secret",
  "privateKey",
  "accessToken",
  "sessionToken",
  "claims",
  "customData",
  "aiPrompt",
  "aiResponse",
]);

const PHI_VALUE_PATTERNS: Array<RegExp> = [
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,
  /\b\+?\d[\d\s().-]{7,}\d\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
];

function isRedactedKey(key: string): boolean {
  const lower = key.toLowerCase();
  for (const candidate of REDACTED_KEYS) {
    if (lower === candidate.toLowerCase()) return true;
  }
  return false;
}

function redactString(value: string): string {
  let out = value;
  for (const pattern of PHI_VALUE_PATTERNS) {
    out = out.replace(pattern, "[REDACTED]");
  }
  return out;
}

function redactMeta(meta: unknown, depth = 0): unknown {
  if (depth > 5) return "[DEPTH_LIMIT]";

  if (typeof meta === "string") return redactString(meta);

  if (Array.isArray(meta)) {
    return meta.map((item) => redactMeta(item, depth + 1));
  }

  if (meta && typeof meta === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
      if (isRedactedKey(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactMeta(value, depth + 1);
      }
    }
    return out;
  }

  return meta;
}

function write(level: AppErrorSeverity, message: string, meta?: unknown): void {
  const serialized = meta === undefined ? undefined : redactMeta(meta);
  const rendered = `[logger:${level}] ${message}`;
  if (level === "error" || level === "critical") {
    console.error(rendered, serialized ?? "");
  } else if (level === "warning") {
    console.warn(rendered, serialized ?? "");
  } else {

    console.log(rendered, serialized ?? "");
  }
}

export const logger = {
  debug(message: string, meta?: unknown): void {
    write("debug", message, meta);
  },
  info(message: string, meta?: unknown): void {
    write("info", message, meta);
  },
  warn(message: string, meta?: unknown): void {
    write("warning", message, meta);
  },
  error(message: string, meta?: unknown): void {
    write("error", message, meta);
  },
};

export { REDACTED_KEYS, PHI_VALUE_PATTERNS, redactMeta };
