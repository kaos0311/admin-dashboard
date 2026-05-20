import type { NormalizedInsurance, RawImportRow } from "../types";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function keyString(value: unknown): string {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFirst(row: RawImportRow, keys: string[]): string {
  for (const key of keys) {
    const value = cleanString(row[key]);
    if (value) return value;
  }

  return "";
}

export function normalizeInsurance(row: RawImportRow): NormalizedInsurance {
  const primaryPayor = getFirst(row, [
    "primaryPayor",
    "primaryInsurance",
    "Primary Payor",
    "Primary Insurance",
    "Payer",
    "Payor",
    "Insurance",
  ]);

  const secondaryPayor = getFirst(row, [
    "secondaryPayor",
    "secondaryInsurance",
    "Secondary Payor",
    "Secondary Insurance",
  ]);

  const policyNumber = getFirst(row, [
    "policyNumber",
    "Policy Number",
    "Policy #",
    "Member ID",
    "Subscriber ID",
    "Insurance ID",
  ]);

  const insuranceType = primaryPayor
    ? "primary"
    : secondaryPayor
      ? "secondary"
      : "unknown";

  const payorKey =
    keyString(primaryPayor) ||
    keyString(secondaryPayor) ||
    "unknown-payor";

  return {
    payorKey,
    primaryPayor,
    secondaryPayor,
    policyNumber,
    insuranceType,
  };
}