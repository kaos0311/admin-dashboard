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

function toIsoOrNull(value: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function normalizeDates(row: RawImportRow) {
  const serviceDateRaw = get(row, ["serviceDate", "Service Date", "DOS", "Date"]);
  const createdDateRaw = get(row, ["createdAt", "Created At", "Created Date"]);
  const deliveryDateRaw = get(row, ["deliveryDate", "Delivery Date"]);

  return {
    serviceDate: toIsoOrNull(serviceDateRaw),
    createdDate: toIsoOrNull(createdDateRaw),
    deliveryDate: toIsoOrNull(deliveryDateRaw),
    serviceDateRaw,
    createdDateRaw,
    deliveryDateRaw,
  };
}