import { shortHash } from "../../lib/imports/hash";

const MAX_TOKEN_COUNT = 40;

const TOKEN_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "inc",
  "llc",
  "of",
  "on",
  "or",
  "plan",
  "the",
  "to",
  "unknown",
]);

export function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeKey(value: string): string {
  return cleanKey(value);
}

export function readFirstString(
  row: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = cleanText(row[key]);

    if (value.length > 0) {
      return value;
    }
  }

  return null;
}

export function safeFirestoreId(value: string): string {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return cleaned || shortHash(value);
}

export function parseMoney(value: unknown): number {
  const cleaned = cleanText(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\((.*?)\)/g, "-$1")
    .replace(/[^\d.-]/g, "");

  const parsed = Number.parseFloat(cleaned);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function parseQuantity(value: unknown): number {
  const parsed = Number.parseFloat(cleanText(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDateToIso(value: unknown): string | null {
  const raw = cleanText(value);
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (dateOnlyMatch) {
    const month = Number(dateOnlyMatch[1]);
    const day = Number(dateOnlyMatch[2]);
    let year = Number(dateOnlyMatch[3]);

    if (year < 100) {
      year += year > 30 ? 1900 : 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const cleaned = cleanText(fullName).replace(/\*/g, "").trim();

  if (!cleaned) {
    return { firstName: "", lastName: "" };
  }

  if (cleaned.includes(",")) {
    const [lastRaw, firstRaw] = cleaned.split(",");
    return {
      firstName: cleanText(firstRaw),
      lastName: cleanText(lastRaw),
    };
  }

  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] ?? "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

export function normalizeHcpcs(value: unknown): string {
  return cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function normalizePayor(value: unknown): string {
  const cleaned = cleanText(value)
    .replace(/\*/g, "")
    .replace(/\bINC\b\.?/gi, "")
    .replace(/\bLLC\b\.?/gi, "")
    .replace(/\bPLAN\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "Unknown";
}

export function buildSearchTokens(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();

  for (const value of values) {
    const key = cleanKey(value ?? "");
    if (!key) continue;

    for (const part of key.split("_")) {
      if (part.length >= 2 && !TOKEN_STOP_WORDS.has(part)) {
        tokens.add(part);
      }
    }

    if (key.length >= 2 && !TOKEN_STOP_WORDS.has(key)) {
      tokens.add(key);
    }
  }

  return Array.from(tokens).slice(0, MAX_TOKEN_COUNT);
}