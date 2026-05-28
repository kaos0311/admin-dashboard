type SearchTextInput =
  | unknown[]
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null
  | undefined;

export function toSafeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return fallback;
}

export function toSafeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%\s,]/g, "");
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function normalizeSearchText(value: unknown): string {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchText(input: SearchTextInput): string {
  const values = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? Object.values(input)
      : [input];

  return normalizeSearchText(values.filter(Boolean).join(" "));
}
