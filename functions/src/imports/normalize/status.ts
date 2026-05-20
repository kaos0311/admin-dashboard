import type { RawImportRow } from "../types";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function get(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return "";
}

export function normalizeStatus(row: RawImportRow) {
  const rawStatus = get(row, ["status", "Status", "Order Status", "Patient Status"]);

  return {
    status: rawStatus || "unknown",
    rawStatus,
  };
}