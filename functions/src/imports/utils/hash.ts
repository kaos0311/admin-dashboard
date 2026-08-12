import { createHash } from "crypto";

export function stableHash(value: unknown): string {
  const normalized = JSON.stringify(value, Object.keys(flattenKeys(value)).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

function flattenKeys(value: unknown, prefix = "", output: Record<string, true> = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      output[next] = true;
      flattenKeys(child, next, output);
    }
  }
  return output;
}

export function safeFirestoreId(input: string, fallback = "unknown"): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[\/\\#[\].$]/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || `${fallback}-${Date.now()}`;
}
