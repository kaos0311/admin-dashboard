type UnknownRecord = Record<string, unknown>;

export function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function getString(
  data: UnknownRecord,
  key: string,
  fallback = ""
): string {
  const value = data[key];

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed.length > 0
      ? trimmed
      : fallback;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
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

    return trimmed.length > 0
      ? trimmed
      : null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
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
    return new Date(
      value.seconds * 1000
    ).toISOString();
  }

  return null;
}

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const cleanedValue = value
      .replace(/[$,%]/g, "")
      .replace(/,/g, "")
      .trim();

    if (cleanedValue.length === 0) {
      return fallback;
    }

    const parsedValue = Number(cleanedValue);

    return Number.isFinite(parsedValue)
      ? parsedValue
      : fallback;
  }

  return fallback;
}

export function safePositiveNumber(
  value: unknown
): number {
  return Math.max(
    safeNumber(value),
    0
  );
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

export function normalizeStatus(
  value: unknown,
  fallback = "unknown"
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return normalized.length > 0
    ? normalized
    : fallback;
}


