export * from "./dashboard-constants";
export * from "./dashboard-normalizers";

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  const parsedValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

export function safeString(
  value: unknown,
  fallback = ""
): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return fallback;
}

export function safeArray<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? [...(value as T[])]
    : [];
}

export function formatMoney(
  value: unknown
): string {
  const amount = safeNumber(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function normalizeSearchText(
  value: unknown
): string {
  return safeString(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
