import type { ImportRow } from "../../types/stagingChunk";

export function read(row: ImportRow, keys: string[]): string {
  const normalizedRow = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    normalizedRow.set(normalizeLookupKey(key), value);
  }

  for (const key of keys) {
    const value = row[key] ?? normalizedRow.get(normalizeLookupKey(key));
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function clean<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return false;
      return true;
    })
  ) as T;
}

function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, "number")
    .replace(/[^a-z0-9]+/g, "");
}

export function toNumber(value: string): number {
  const parsed = Number(value.replace(/[$,% ,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toDateString(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function toBoolean(value: string): boolean {
  return ["true", "yes", "y", "1"].includes(value.toLowerCase());
}

export function normalizeStatus(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return "active";
  if (["inactive", "discontinued", "archived"].includes(text)) return text;
  return "active";
}

export function compactRemittanceAddress(row: ImportRow) {
  return clean({
    address1: read(row, ["RemittanceAddress1"]),
    address2: read(row, ["RemittanceAddress2"]),
    city: read(row, ["RemittanceCity"]),
    state: read(row, ["RemittanceState"]),
    zip: read(row, ["RemittanceZipCode"]),
  });
}
