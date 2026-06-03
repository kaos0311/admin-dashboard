import type { ImportedRowWrapper } from "./types";

import { createHash } from "crypto";
export function normalizeString(value: unknown): string {
  return value === null ? "" : String(value).trim();
}

export function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function stableHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 24);
}

export function safeDocId(value: string): string {
  const clean = normalizeKey(value);
  return clean || stableHash(value || "unknown");
}

export function unwrapRow(row: Record<string, unknown>): Record<string, unknown> {
  const wrapped = row as ImportedRowWrapper;

  if (
    wrapped.data &&
    typeof wrapped.data === "object" &&
    !Array.isArray(wrapped.data)
  ) {
    return wrapped.data;
  }

  return row;
}

export function valueFromAliases(row: Record<string, unknown>, aliases: string[]): string {
  const source = unwrapRow(row);
  const entries = Object.entries(source);

  for (const alias of aliases) {
    const aliasKey = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === aliasKey);

    if (found) {
      const value = normalizeString(found[1]);
      if (value) return value;
    }
  }

  return "";
}

export function numberFromAliases(row: Record<string, unknown>, aliases: string[]): number {
  const raw = valueFromAliases(row, aliases);
  if (!raw) return 0;

  const parsed = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function boolFromAliases(row: Record<string, unknown>, aliases: string[]): boolean {
  const value = valueFromAliases(row, aliases).toLowerCase();

  return (
    value === "yes" ||
    value === "true" ||
    value === "1" ||
    value === "y" ||
    value === "complete" ||
    value === "completed" ||
    value === "verified"
  );
}

export function normalizeIsoDate(value: string): string {
  const raw = normalizeString(value).replace(/\s+12:00:00\s+AM$/i, "");
  if (!raw) return "";

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

export function isWithinLastDays(dateValue: string, days: number): boolean {
  const normalized = normalizeIsoDate(dateValue);
  if (!normalized) return false;

  const parsed = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;

  const diff = Date.now() - parsed.getTime();
  const limit = days * 24 * 60 * 60 * 1000;

  return diff >= 0 && diff <= limit;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function parseFullName(rawFullName: string) {
  const sourceFullName = normalizeString(rawFullName).replace(/\s+/g, " ");
  let firstName = "";
  let lastName = "";

  if (sourceFullName.includes(",")) {
    const [rawLast, rawRest] = sourceFullName.split(",", 2);
    lastName = titleCase(rawLast || "");
    firstName = titleCase((rawRest || "").trim().split(/\s+/)[0] || "");
  } else {
    const parts = sourceFullName.split(/\s+/).filter(Boolean);
    firstName = titleCase(parts[0] || "");
    lastName = titleCase(parts[parts.length - 1] || "");
  }

  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    sourceFullName,
  };
}

export function buildPatientId(input: {
  firstName: string;
  lastName: string;
  dob: string;
  accountNumber?: string;
  brightreePatientId?: string;
  brightreePatientKey?: string;
}): string {
  const primary =
    input.brightreePatientKey ||
    input.brightreePatientId ||
    input.accountNumber ||
    "";

  if (primary) {
    return `pt_${stableHash(primary)}`;
  }

  return `pt_${stableHash(
    [
      normalizeKey(input.lastName),
      normalizeKey(input.firstName),
      normalizeKey(input.dob || "unknown-dob"),
    ].join("|")
  )}`;
}










