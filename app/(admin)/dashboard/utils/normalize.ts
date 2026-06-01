export function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "";
}

export function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : fallback;
  }

  if (typeof value === "string") {
    const cleanedValue = value
      .replace(/[$,%\s,]/g, "")
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

export function formatMoney(
  value: unknown
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

export function formatWholeNumber(
  value: unknown
): string {
  return safeNumber(value).toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 0,
    }
  );
}

export function formatPercent(
  value: unknown
): string {
  return `${safeNumber(value).toFixed(1)}%`;
}

export function normalizeSearchText(
  value: unknown
): string {
  return safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


