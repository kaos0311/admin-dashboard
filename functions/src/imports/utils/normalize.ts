// functions/src/imports/utils/normalize.ts

const HOSPICE_KEYWORDS = [
  "hospice",
  "pennyroyal",
  "terminal",
  "comfort care",
  "end of life",
  "deceased",
  "dod",
  "date of death",
  "expired",
];

const MAX_DOC_ID_LENGTH = 140;

export function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanLowerText(value: unknown): string {
  return cleanText(value).toLowerCase();
}

export function cleanMoney(value: unknown): number {
  const raw = cleanText(value);

  if (!raw) return 0;

  const isNegativeAccounting = /^\(.*\)$/.test(raw);

  const cleaned = raw
    .replace(/[,$]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return 0;

  return isNegativeAccounting ? -Math.abs(parsed) : parsed;
}

export function cleanNumber(value: unknown, fallback = 0): number {
  const raw = cleanText(value);

  if (!raw) return fallback;

  const cleaned = raw.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSearchText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKey(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function makeSafeDocId(value: string): string {
  const safe = normalizeSearchText(value)
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_DOC_ID_LENGTH);

  return safe || "unknown";
}

export function uniqueCleanList(values: unknown[]): string[] {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

export function stripHospiceMarker(value: unknown): string {
  return cleanText(value)
    .replace(/^\*+/, "")
    .replace(/\*+$/, "")
    .trim();
}

export function hasHospiceMarker(value: unknown): boolean {
  const text = cleanText(value);

  if (!text) return false;

  return text.startsWith("*") || text.endsWith("*");
}

export function getCsvField(
  row: Record<string, unknown> | undefined | null,
  possibleNames: string[]
): string {
  if (!row) return "";

  const normalizedLookup = new Set(possibleNames.map(normalizeKey));

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);

    if (normalizedLookup.has(normalizedKey)) {
      return cleanText(value);
    }
  }

  return "";
}

export function getCsvFieldAny(
  row: Record<string, unknown> | undefined | null,
  possibleNames: string[]
): unknown {
  if (!row) return "";

  const normalizedLookup = new Set(possibleNames.map(normalizeKey));

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);

    if (normalizedLookup.has(normalizedKey)) {
      return value;
    }
  }

  return "";
}

export function detectHospiceFromValues(values: unknown[]): boolean {
  const cleanedValues = values.map(cleanLowerText).filter(Boolean);

  const keywordMatch = cleanedValues.some((value) =>
    HOSPICE_KEYWORDS.some((keyword) => value.includes(keyword))
  );

  if (keywordMatch) return true;

  return values.some((value) => hasHospiceMarker(value));
}

export function patientKeyFrom(
  name: string,
  dob: string,
  customerId: string
): string {
  const cleanedName = stripHospiceMarker(name);

  const namePart =
    normalizeSearchText(cleanedName).replace(/\s+/g, "-").slice(0, 80) ||
    "unknown";

  const dobPart = cleanText(dob).replace(/[^\d]/g, "").slice(0, 12) || "nodob";

  const customerPart =
    cleanText(customerId).replace(/[^\dA-Za-z]/g, "").slice(0, 40) ||
    "nocustomer";

  return makeSafeDocId(`${namePart}_${dobPart}_${customerPart}`);
}

export function normalizePhone(value: unknown): string {
  const digits = cleanText(value).replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }

  return digits;
}

export function normalizeDateText(value: unknown): string {
  const text = cleanText(value);

  if (!text) return "";

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const day = String(parsed.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return text;
}

export function booleanFrom(value: unknown, fallback = false): boolean {
  const text = cleanLowerText(value);

  if (!text) return fallback;

  if (["true", "yes", "y", "1", "active"].includes(text)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(text)) return false;

  return fallback;
}

export function compactObject<T extends Record<string, unknown>>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as T;
}