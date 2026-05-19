type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getString(
  data: UnknownRecord,
  key: string,
  fallback = ""
): string {
  const value = data[key];

  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

export function getNullableString(
  data: UnknownRecord,
  key: string
): string | null {
  const value = data[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    isRecord(value) &&
    typeof value.seconds === "number" &&
    Number.isFinite(value.seconds)
  ) {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

export function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function safePositiveNumber(value: unknown): number {
  return Math.max(safeNumber(value), 0);
}

export function safeArray<T>(
  value: unknown,
  normalizer: (item: unknown) => T
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizer);
}

export function normalizeStatus(value: unknown, fallback = "unknown"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");

  return normalized || fallback;
}