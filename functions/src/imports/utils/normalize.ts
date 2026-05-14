// functions/src/imports/utils/normalize.ts

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
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function makeSafeDocId(value: string): string {
  const safe = normalizeSearchText(value)
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140);

  return safe || "unknown";
}

export function uniqueCleanList(values: unknown[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

export function getCsvField(
  row: Record<string, unknown> | undefined | null,
  possibleNames: string[]
): string {
  if (!row) return "";

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
    combined.includes("end of life") ||
    combined.includes("terminal") ||
    combined.includes("deceased")
  );
}

export function patientKeyFrom(
  name: string,
  dob: string,
  customerId: string
): string {
  const namePart =
    normalizeSearchText(name).replace(/\s+/g, "-").slice(0, 80) || "unknown";

  const dobPart = cleanText(dob).replace(/[^\d]/g, "").slice(0, 12) || "nodob";

  const customerPart =
    cleanText(customerId).replace(/[^\dA-Za-z]/g, "").slice(0, 40) ||
    "nocustomer";

  return makeSafeDocId(`${namePart}_${dobPart}_${customerPart}`);
}