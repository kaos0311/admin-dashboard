export function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function cleanMoney(value: unknown): number {
  const cleaned = String(value ?? "").replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanNumber(value: unknown, fallback = 0): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSearchText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function makeSafeDocId(value: string): string {
  return normalizeSearchText(value)
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);
}

export function uniqueCleanList(values: unknown[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

export function getCsvField(
  row: Record<string, unknown>,
  possibleNames: string[]
): string {
  const entries = Object.entries(row);

  const normalizedLookup = possibleNames.map(normalizeKey);

  for (const [key, value] of entries) {
    const normalizedKey = normalizeKey(key);

    if (normalizedLookup.includes(normalizedKey)) {
      return cleanText(value);
    }
  }

  return "";
}

export function detectHospiceFromValues(values: unknown[]): boolean {
  const combined = values.map(cleanText).join(" ").toLowerCase();

  return (
    combined.includes("hospice") ||
    combined.includes("pennyroyal") ||
    combined.includes("end of life")
  );
}

export function patientKeyFrom(
  name: string,
  dob: string,
  customerId: string
): string {
  const namePart =
    normalizeSearchText(name).replace(/\s+/g, "-") || "unknown";

  const dobPart = dob.replace(/[^\d]/g, "") || "nodob";

  const customerPart =
    customerId.replace(/[^\dA-Za-z]/g, "") || "nocustomer";

  return `${namePart}_${dobPart}_${customerPart}`;
}